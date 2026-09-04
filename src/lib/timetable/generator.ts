/**
 * The automatic timetable generator — a pure function with no Prisma calls,
 * so it's directly unit-testable. src/lib/timetable/generate-timetable.ts
 * loads the real data into this shape, calls generateSchedule(), and
 * persists the result.
 *
 * This is deliberately a constructive heuristic with bounded local repair,
 * not a full backtracking/ILP solver — exact timetable CSP solving is
 * NP-hard, and this codebase has no job queue to fall back on if a search
 * ran long (see IDCardGenerationJob/ImportJob — both do their work
 * synchronously inside the request). The approach below is the standard
 * practical pattern for school timetabling: most-constrained-first greedy
 * placement, repeated a few times with randomized tie-breaking, plus a
 * bounded local-repair pass for whatever's left unplaced.
 */

export interface RoomDef {
  id: string;
  /** null = any subject may use this room. */
  allowedSubjectIds: string[] | null;
}

export interface TeacherDef {
  id: string;
  maxPeriodsPerDay: number | null;
  maxConsecutivePeriods: number | null;
  unavailableWholeDays: Set<string>;
  /** `${dayOfWeek}|${periodId}` */
  unavailableSlots: Set<string>;
}

export interface RequirementInput {
  /** SubjectAssignment id — carried through to placements/unplaced entries for traceability. */
  id: string;
  sectionId: string;
  subjectId: string;
  teacherId: string | null;
  periodsPerWeek: number;
  preferDoublePeriod: boolean;
  /** Set = this requirement needs a specific/suitable room; null = no room tracked. */
  preferredRoomId: string | null;
}

export interface PeriodDef {
  id: string;
  sortOrder: number;
}

export interface GeneratorInput {
  /** Working days for this timetable, e.g. ["monday",...,"saturday"]. */
  days: string[];
  /** Teaching-kind periods only, in display order. */
  periods: PeriodDef[];
  requirements: RequirementInput[];
  rooms: RoomDef[];
  teachers: Map<string, TeacherDef>;
  /**
   * Existing manually-placed slots (source="manual" in the DB) that must be
   * treated as already-occupied and never moved or overwritten — the
   * generator plans the rest of the schedule around them.
   */
  lockedPlacements?: PlacedUnit[];
  /** Number of full construction attempts to keep the best of. Default 6. */
  restarts?: number;
  /** Local-repair attempts per still-unplaced unit after the best restart. Default 10. */
  repairAttemptsPerUnit?: number;
  /** Seed for reproducible runs (tests); omit for a fresh random seed each call. */
  randomSeed?: number;
}

export interface PlacedUnit {
  requirementId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string | null;
  roomId: string | null;
  dayOfWeek: string;
  periodId: string;
}

export interface UnplacedUnit {
  requirementId: string;
  sectionId: string;
  subjectId: string;
  reason: string;
}

export interface GeneratorResult {
  totalUnits: number;
  placed: PlacedUnit[];
  unplaced: UnplacedUnit[];
  softScore: number;
}

// ---------------------------------------------------------------------------
// Internal working types
// ---------------------------------------------------------------------------

interface Unit {
  requirementId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string | null;
  preferredRoomId: string | null;
  isDoublePeriodPreferred: boolean;
  /** Groups the units of one requirement so the double-period pass can pair them. */
  pairKey: string;
}

function slotKey(dayOfWeek: string, periodId: string): string {
  return `${dayOfWeek}|${periodId}`;
}

/** Small deterministic PRNG (mulberry32) — no new dependency, reproducible with a seed. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expandUnits(requirements: RequirementInput[]): Unit[] {
  const units: Unit[] = [];
  for (const req of requirements) {
    for (let i = 0; i < req.periodsPerWeek; i++) {
      units.push({
        requirementId: req.id,
        sectionId: req.sectionId,
        subjectId: req.subjectId,
        teacherId: req.teacherId,
        preferredRoomId: req.preferredRoomId,
        isDoublePeriodPreferred: req.preferDoublePeriod,
        pairKey: req.id,
      });
    }
  }
  return units;
}

/** Total weekly periods per teacher, from the requirements — the "how constrained is this teacher overall" signal. */
function computeTeacherLoad(requirements: RequirementInput[]): Map<string, number> {
  const load = new Map<string, number>();
  for (const req of requirements) {
    if (!req.teacherId) continue;
    load.set(req.teacherId, (load.get(req.teacherId) ?? 0) + req.periodsPerWeek);
  }
  return load;
}

function orderUnits(units: Unit[], teacherLoad: Map<string, number>, rng: () => number): Unit[] {
  // Stable jitter: attach a random tiebreak value once, so equal-priority units
  // shuffle between restarts without re-randomizing on every comparator call.
  const withJitter = units.map((unit) => ({ unit, jitter: rng() }));
  withJitter.sort((a, b) => {
    const roomScore = (u: Unit) => (u.preferredRoomId ? 1 : 0);
    const roomDiff = roomScore(b.unit) - roomScore(a.unit);
    if (roomDiff !== 0) return roomDiff;

    const loadOf = (u: Unit) => (u.teacherId ? teacherLoad.get(u.teacherId) ?? 0 : 0);
    const loadDiff = loadOf(b.unit) - loadOf(a.unit);
    if (loadDiff !== 0) return loadDiff;

    return a.jitter - b.jitter;
  });
  return withJitter.map((w) => w.unit);
}

interface ConstructionState {
  sectionSlotOccupied: Set<string>; // `${sectionId}|${day}|${periodId}`
  teacherSlotOccupied: Set<string>; // `${teacherId}|${day}|${periodId}`
  roomSlotOccupied: Set<string>; // `${roomId}|${day}|${periodId}`
  /** `${sectionId}|${day}` -> Map<periodSortOrder, subjectId>, for adjacency/consecutive checks. */
  sectionDaySubjectBySortOrder: Map<string, Map<number, string>>;
  /** `${sectionId}|${subjectId}|${day}` -> count placed that day. */
  sectionSubjectDayCount: Map<string, number>;
  /** `${teacherId}|${day}` -> periods placed so far that day. */
  teacherDayCount: Map<string, number>;
  /** pairKey -> last placed {day, periodId, sortOrder}, for the double-period pass. */
  pairLastPlacement: Map<string, { day: string; periodId: string; sortOrder: number }>;
  placements: PlacedUnit[];
}

function createState(): ConstructionState {
  return {
    sectionSlotOccupied: new Set(),
    teacherSlotOccupied: new Set(),
    roomSlotOccupied: new Set(),
    sectionDaySubjectBySortOrder: new Map(),
    sectionSubjectDayCount: new Map(),
    teacherDayCount: new Map(),
    pairLastPlacement: new Map(),
    placements: [],
  };
}

function findRoom(unit: Unit, day: string, periodId: string, rooms: RoomDef[], state: ConstructionState): string | null | "unavailable" {
  if (!unit.preferredRoomId) return null; // room not tracked for this requirement
  const suitable = rooms.filter((r) => r.allowedSubjectIds === null || r.allowedSubjectIds.includes(unit.subjectId));
  if (suitable.length === 0) return "unavailable";
  const preferredFirst = [...suitable].sort((a, b) => {
    const aPref = a.id === unit.preferredRoomId ? 0 : 1;
    const bPref = b.id === unit.preferredRoomId ? 0 : 1;
    return aPref - bPref;
  });
  for (const room of preferredFirst) {
    if (!state.roomSlotOccupied.has(`${room.id}|${day}|${periodId}`)) return room.id;
  }
  return "unavailable";
}

function isHardValid(
  unit: Unit,
  day: string,
  periodId: string,
  teachers: Map<string, TeacherDef>,
  state: ConstructionState,
): boolean {
  if (state.sectionSlotOccupied.has(`${unit.sectionId}|${day}|${periodId}`)) return false;

  if (unit.teacherId) {
    if (state.teacherSlotOccupied.has(`${unit.teacherId}|${day}|${periodId}`)) return false;
    const teacher = teachers.get(unit.teacherId);
    if (teacher) {
      if (teacher.unavailableWholeDays.has(day)) return false;
      if (teacher.unavailableSlots.has(slotKey(day, periodId))) return false;
    }
  }

  return true;
}

function adjacentSubjectsCount(unit: Unit, day: string, sortOrder: number, state: ConstructionState): number {
  const daySubjects = state.sectionDaySubjectBySortOrder.get(`${unit.sectionId}|${day}`);
  if (!daySubjects) return 0;
  let count = 0;
  if (daySubjects.get(sortOrder - 1) === unit.subjectId) count++;
  if (daySubjects.get(sortOrder + 1) === unit.subjectId) count++;
  return count;
}

function softScoreCandidate(
  unit: Unit,
  day: string,
  periodId: string,
  sortOrder: number,
  teachers: Map<string, TeacherDef>,
  state: ConstructionState,
): number {
  let score = 0;

  const dayCount = state.sectionSubjectDayCount.get(`${unit.sectionId}|${unit.subjectId}|${day}`) ?? 0;
  if (dayCount > 0) {
    // Repeating a subject the same day is discouraged — unless this is a
    // double-period subject, where stacking within the day is the goal.
    score += unit.isDoublePeriodPreferred ? -8 : 18;
  }

  const adjacentSame = adjacentSubjectsCount(unit, day, sortOrder, state);
  if (adjacentSame > 0 && !unit.isDoublePeriodPreferred) score += 12 * adjacentSame;
  if (adjacentSame > 0 && unit.isDoublePeriodPreferred) score -= 15; // reward landing next to its pair

  if (unit.teacherId) {
    const teacher = teachers.get(unit.teacherId);
    const teacherDayCount = state.teacherDayCount.get(`${unit.teacherId}|${day}`) ?? 0;
    if (teacher?.maxPeriodsPerDay != null) {
      if (teacherDayCount >= teacher.maxPeriodsPerDay) score += 500; // heavily discouraged, not hard-blocked
      else score += teacherDayCount * 2; // mild spread-across-days pressure
    }
  }

  return score;
}

function placeUnit(unit: Unit, day: string, periodId: string, sortOrder: number, roomId: string | null, state: ConstructionState): void {
  state.sectionSlotOccupied.add(`${unit.sectionId}|${day}|${periodId}`);
  if (unit.teacherId) {
    state.teacherSlotOccupied.add(`${unit.teacherId}|${day}|${periodId}`);
    state.teacherDayCount.set(`${unit.teacherId}|${day}`, (state.teacherDayCount.get(`${unit.teacherId}|${day}`) ?? 0) + 1);
  }
  if (roomId) state.roomSlotOccupied.add(`${roomId}|${day}|${periodId}`);

  const dayMapKey = `${unit.sectionId}|${day}`;
  const dayMap = state.sectionDaySubjectBySortOrder.get(dayMapKey) ?? new Map<number, string>();
  dayMap.set(sortOrder, unit.subjectId);
  state.sectionDaySubjectBySortOrder.set(dayMapKey, dayMap);

  const dayCountKey = `${unit.sectionId}|${unit.subjectId}|${day}`;
  state.sectionSubjectDayCount.set(dayCountKey, (state.sectionSubjectDayCount.get(dayCountKey) ?? 0) + 1);

  state.pairLastPlacement.set(unit.pairKey, { day, periodId, sortOrder });

  state.placements.push({
    requirementId: unit.requirementId,
    sectionId: unit.sectionId,
    subjectId: unit.subjectId,
    teacherId: unit.teacherId,
    roomId,
    dayOfWeek: day,
    periodId,
  });
}

function releaseUnit(placement: PlacedUnit, state: ConstructionState): void {
  state.sectionSlotOccupied.delete(`${placement.sectionId}|${placement.dayOfWeek}|${placement.periodId}`);
  if (placement.teacherId) state.teacherSlotOccupied.delete(`${placement.teacherId}|${placement.dayOfWeek}|${placement.periodId}`);
  if (placement.roomId) state.roomSlotOccupied.delete(`${placement.roomId}|${placement.dayOfWeek}|${placement.periodId}`);
}

function reoccupyUnit(placement: PlacedUnit, day: string, periodId: string, state: ConstructionState): void {
  state.sectionSlotOccupied.add(`${placement.sectionId}|${day}|${periodId}`);
  if (placement.teacherId) state.teacherSlotOccupied.add(`${placement.teacherId}|${day}|${periodId}`);
  if (placement.roomId) state.roomSlotOccupied.add(`${placement.roomId}|${day}|${periodId}`);
}

/**
 * Marks a manually-locked slot as occupied so construction plans around it,
 * without adding it to `state.placements` — it's already persisted with
 * source="manual" and must never be re-emitted as a new "auto" placement or
 * be a candidate for local repair to move.
 */
function seedLocked(placement: PlacedUnit, periods: PeriodDef[], state: ConstructionState): void {
  const sortOrder = periods.find((p) => p.id === placement.periodId)?.sortOrder ?? 0;

  state.sectionSlotOccupied.add(`${placement.sectionId}|${placement.dayOfWeek}|${placement.periodId}`);
  if (placement.teacherId) {
    state.teacherSlotOccupied.add(`${placement.teacherId}|${placement.dayOfWeek}|${placement.periodId}`);
    const key = `${placement.teacherId}|${placement.dayOfWeek}`;
    state.teacherDayCount.set(key, (state.teacherDayCount.get(key) ?? 0) + 1);
  }
  if (placement.roomId) state.roomSlotOccupied.add(`${placement.roomId}|${placement.dayOfWeek}|${placement.periodId}`);

  const dayMapKey = `${placement.sectionId}|${placement.dayOfWeek}`;
  const dayMap = state.sectionDaySubjectBySortOrder.get(dayMapKey) ?? new Map<number, string>();
  dayMap.set(sortOrder, placement.subjectId);
  state.sectionDaySubjectBySortOrder.set(dayMapKey, dayMap);

  const dayCountKey = `${placement.sectionId}|${placement.subjectId}|${placement.dayOfWeek}`;
  state.sectionSubjectDayCount.set(dayCountKey, (state.sectionSubjectDayCount.get(dayCountKey) ?? 0) + 1);
}

/**
 * Bounded local repair (spec's "Automatic Conflict Resolution", §18): for a
 * still-unplaced unit, look at slots currently occupied by some other
 * placement in the same section, and try relocating that occupant elsewhere
 * valid so the target unit can take its slot. Mutates `state`/`unplaced` in
 * place. `unitsByRequirementId` recovers the target's real teacherId/
 * preferredRoomId — the repair must honor the same constraints construction
 * did, not silently drop them.
 */
function localRepair(
  unplaced: UnplacedUnit[],
  unitsByRequirementId: Map<string, Unit>,
  days: string[],
  periods: PeriodDef[],
  rooms: RoomDef[],
  teachers: Map<string, TeacherDef>,
  state: ConstructionState,
  maxAttemptsPerUnit: number,
): void {
  for (let i = unplaced.length - 1; i >= 0; i--) {
    const target = unplaced[i];
    const targetUnit = unitsByRequirementId.get(target.requirementId);
    if (!targetUnit) continue;

    let fixed = false;
    let attempts = 0;

    outer: for (const day of days) {
      for (const period of periods) {
        if (attempts >= maxAttemptsPerUnit) break outer;

        const occupantIndex = state.placements.findIndex(
          (p) => p.sectionId === target.sectionId && p.dayOfWeek === day && p.periodId === period.id,
        );
        if (occupantIndex === -1) continue; // an open slot would already have been used during construction
        attempts++;
        const occupant = state.placements[occupantIndex];

        const occupantUnit: Unit = {
          requirementId: occupant.requirementId,
          sectionId: occupant.sectionId,
          subjectId: occupant.subjectId,
          teacherId: occupant.teacherId,
          preferredRoomId: occupant.roomId, // best-effort: keep it in an equally suitable room
          isDoublePeriodPreferred: false,
          pairKey: `repair-occupant-${occupant.requirementId}`,
        };

        releaseUnit(occupant, state);

        let newHome: { day: string; periodId: string; sortOrder: number; roomId: string | null } | null = null;
        for (const altDay of days) {
          if (newHome) break;
          for (const altPeriod of periods) {
            if (altDay === day && altPeriod.id === period.id) continue;
            if (!isHardValid(occupantUnit, altDay, altPeriod.id, teachers, state)) continue;
            const room = findRoom(occupantUnit, altDay, altPeriod.id, rooms, state);
            if (room === "unavailable") continue;
            newHome = { day: altDay, periodId: altPeriod.id, sortOrder: altPeriod.sortOrder, roomId: room };
            break;
          }
        }

        if (!newHome) {
          reoccupyUnit(occupant, day, period.id, state); // couldn't relocate — put it back, try the next occupied slot
          continue;
        }

        if (!isHardValid(targetUnit, day, period.id, teachers, state)) {
          reoccupyUnit(occupant, day, period.id, state); // target doesn't fit here either — undo and move on
          continue;
        }
        const targetRoom = findRoom(targetUnit, day, period.id, rooms, state);
        if (targetRoom === "unavailable") {
          reoccupyUnit(occupant, day, period.id, state);
          continue;
        }

        // Both sides check out — commit: occupant moves to its new home, target takes the freed slot.
        state.placements.splice(occupantIndex, 1);
        placeUnit(occupantUnit, newHome.day, newHome.periodId, newHome.sortOrder, newHome.roomId, state);
        placeUnit(targetUnit, day, period.id, period.sortOrder, targetRoom, state);
        unplaced.splice(i, 1);
        fixed = true;
        break outer;
      }
    }

    void fixed; // loop control only — nothing further to do per-unit once broken out of
  }
}

interface ConstructionResult {
  state: ConstructionState;
  unplaced: UnplacedUnit[];
  softScore: number;
}

function runOneConstruction(
  units: Unit[],
  days: string[],
  periods: PeriodDef[],
  rooms: RoomDef[],
  teachers: Map<string, TeacherDef>,
  teacherLoad: Map<string, number>,
  repairAttemptsPerUnit: number,
  rng: () => number,
  lockedPlacements: PlacedUnit[],
): ConstructionResult {
  const state = createState();
  for (const locked of lockedPlacements) seedLocked(locked, periods, state);

  const ordered = orderUnits(units, teacherLoad, rng);
  const unitsByRequirementId = new Map(units.map((u) => [u.requirementId, u]));
  const unplaced: UnplacedUnit[] = [];
  let softScoreTotal = 0;

  for (const unit of ordered) {
    let placedThisUnit = false;

    // Double-period pass: try landing next to the pair's last placement first.
    const pairPrev = state.pairLastPlacement.get(unit.pairKey);
    if (unit.isDoublePeriodPreferred && pairPrev) {
      for (const so of [pairPrev.sortOrder - 1, pairPrev.sortOrder + 1]) {
        const period = periods.find((p) => p.sortOrder === so);
        if (!period) continue;
        if (!isHardValid(unit, pairPrev.day, period.id, teachers, state)) continue;
        const room = findRoom(unit, pairPrev.day, period.id, rooms, state);
        if (room === "unavailable") continue;
        placeUnit(unit, pairPrev.day, period.id, so, room, state);
        placedThisUnit = true;
        break;
      }
    }

    if (!placedThisUnit) {
      let best: { day: string; periodId: string; sortOrder: number; roomId: string | null; score: number } | null = null;
      for (const day of days) {
        for (const period of periods) {
          if (!isHardValid(unit, day, period.id, teachers, state)) continue;
          const room = findRoom(unit, day, period.id, rooms, state);
          if (room === "unavailable") continue;
          const score = softScoreCandidate(unit, day, period.id, period.sortOrder, teachers, state);
          if (!best || score < best.score) {
            best = { day, periodId: period.id, sortOrder: period.sortOrder, roomId: room, score };
          }
        }
      }
      if (best) {
        placeUnit(unit, best.day, best.periodId, best.sortOrder, best.roomId, state);
        softScoreTotal += best.score;
        placedThisUnit = true;
      }
    }

    if (!placedThisUnit) {
      unplaced.push({
        requirementId: unit.requirementId,
        sectionId: unit.sectionId,
        subjectId: unit.subjectId,
        reason: "No slot satisfies section/teacher/room availability.",
      });
    }
  }

  if (unplaced.length > 0) {
    localRepair(unplaced, unitsByRequirementId, days, periods, rooms, teachers, state, repairAttemptsPerUnit);
  }

  return { state, unplaced, softScore: softScoreTotal };
}

export function generateSchedule(input: GeneratorInput): GeneratorResult {
  const units = expandUnits(input.requirements);
  const teacherLoad = computeTeacherLoad(input.requirements);
  const restarts = Math.max(1, input.restarts ?? 6);
  const repairAttemptsPerUnit = input.repairAttemptsPerUnit ?? 10;
  const baseSeed = input.randomSeed ?? Date.now();
  const lockedPlacements = input.lockedPlacements ?? [];

  let best: ConstructionResult | null = null;
  for (let attempt = 0; attempt < restarts; attempt++) {
    const rng = createRng(baseSeed + attempt * 104729);
    const result = runOneConstruction(
      units,
      input.days,
      input.periods,
      input.rooms,
      input.teachers,
      teacherLoad,
      repairAttemptsPerUnit,
      rng,
      lockedPlacements,
    );
    if (
      !best ||
      result.unplaced.length < best.unplaced.length ||
      (result.unplaced.length === best.unplaced.length && result.softScore < best.softScore)
    ) {
      best = result;
    }
  }

  const finalResult = best as ConstructionResult; // restarts >= 1, so the loop above always assigns at least once

  return {
    totalUnits: units.length,
    placed: finalResult.state.placements,
    unplaced: finalResult.unplaced,
    softScore: finalResult.softScore,
  };
}
