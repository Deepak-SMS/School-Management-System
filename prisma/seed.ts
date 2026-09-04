import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const STUDENT_FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Arjun", "Reyansh", "Ayaan",
  "Ananya", "Diya", "Saanvi", "Myra", "Aadhya", "Kiara", "Anika", "Riya",
  "Rohan", "Sameer", "Priya", "Neha",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Mehta", "Kapoor",
  "Joshi", "Rao", "Kulkarni", "Chatterjee", "Menon", "Bose", "Malhotra",
  "Chawla", "Desai", "Pillai", "Bhatt", "Agarwal",
];
const HOUSES = ["Amber", "Emerald", "Sapphire", "Ruby"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

async function main() {
  const schoolInfo = {
    address: "42 Lakeview Road",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    pinCode: "411045",
    phone: "+91 20 4567 8900",
    email: "info@greenfieldschool.example",
    website: "www.greenfieldschool.example",
    affiliationBoard: "CBSE",
    schoolCode: "GF-2026",
    principalName: "Vikram Rao",
  };
  const school = await prisma.school.upsert({
    where: { id: "school_greenfield" },
    update: schoolInfo,
    create: {
      id: "school_greenfield",
      name: "Greenfield International School",
      shortName: "Greenfield",
      slug: "greenfield",
      ...schoolInfo,
    },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_label: { schoolId: school.id, label: "2026–27" } },
    update: {},
    create: {
      schoolId: school.id,
      label: "2026–27",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2027-04-30"),
      status: "active",
    },
  });

  const campus = await prisma.campus.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MAIN" } },
    update: {},
    create: { schoolId: school.id, name: "Main Campus", code: "MAIN", campusType: "main" },
  });

  const classNames = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
  const classes = [];
  for (const [index, name] of classNames.entries()) {
    const code = `C${6 + index}`;
    const cls = await prisma.class.upsert({
      where: { schoolId_academicYearId_code: { schoolId: school.id, academicYearId: academicYear.id, code } },
      update: {},
      create: { schoolId: school.id, academicYearId: academicYear.id, campusId: campus.id, name, code, sortOrder: index },
    });
    classes.push(cls);
  }

  const sectionsByClass = new Map<string, { id: string; name: string }[]>();
  for (const cls of classes) {
    const sections = [];
    for (const name of ["A", "B"]) {
      const section = await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name } },
        update: {},
        create: {
          schoolId: school.id,
          classId: cls.id,
          academicYearId: academicYear.id,
          campusId: campus.id,
          name,
          code: `${cls.code}-${name}`,
        },
      });
      sections.push(section);
    }
    sectionsByClass.set(cls.id, sections);
  }

  const existingStudents = await prisma.student.count({ where: { schoolId: school.id } });
  if (existingStudents === 0) {
    for (let i = 0; i < 20; i++) {
      const firstName = pick(STUDENT_FIRST_NAMES, i);
      const lastName = pick(LAST_NAMES, i + 3);
      const cls = classes[i % classes.length];
      const sections = sectionsByClass.get(cls.id)!;
      const section = sections[i % sections.length];
      const admissionNumber = `ADM${String(i + 1).padStart(3, "0")}`;

      await prisma.student.create({
        data: {
          schoolId: school.id,
          admissionNumber,
          firstName,
          lastName,
          dateOfBirth: new Date(2012 - (i % 5), i % 12, (i % 27) + 1),
          gender: i % 2 === 0 ? "male" : "female",
          bloodGroup: pick(BLOOD_GROUPS, i),
          academicYearId: academicYear.id,
          classId: cls.id,
          sectionId: section.id,
          rollNumber: String(i + 1),
          house: pick(HOUSES, i),
          status: "active",
          // Guardians are their own records now, created just below so siblings
          // could share one — see the Guardian/StudentGuardian models.
          guardians: {
            create: {
              relationship: i % 2 === 0 ? "father" : "mother",
              isPrimary: true,
              isEmergencyContact: true,
              isAuthorizedPickup: true,
              canReceiveAcademic: true,
              canReceiveFee: true,
              guardian: {
                create: {
                  schoolId: school.id,
                  firstName: pick(LAST_NAMES, i + 7),
                  lastName,
                  fullName: `${pick(LAST_NAMES, i + 7)} ${lastName}`,
                  mobile: `+91 98${String(1000000 + i * 137).slice(0, 8)}`,
                  city: "Pune",
                  state: "Maharashtra",
                  country: "India",
                },
              },
            },
          },
          city: "Pune",
          state: "Maharashtra",
          country: "India",
        },
      });
    }
  }

  // Real acting users, so audit entries and the activity timeline record who did
  // what instead of falling back to "System" (see src/lib/current-user.ts), and
  // so there are working logins for local dev now that Phase 3 auth is real.
  //
  // One account per role, because the permission matrix
  // (src/config/permissions.ts) is enforced server-side: the only way to
  // exercise what a Principal or Teacher can actually see is to sign in as one.
  //
  // LOCAL DEMO CREDENTIALS ONLY — this password is committed in plain text.
  // Production must seed accounts separately and force a password change.
  const DEMO_PASSWORD = "Password123!";

  // Platform-level Super Admin — belongs to zero schools (see src/lib/platform-auth.ts),
  // signs in separately at /super-admin/login.
  await prisma.user.upsert({
    where: { email: "superadmin@classlane.app" },
    update: { passwordHash: hashPassword(DEMO_PASSWORD), isSuperAdmin: true },
    create: {
      name: "Platform Admin",
      email: "superadmin@classlane.app",
      isActive: true,
      isSuperAdmin: true,
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  });

  const demoAccounts = [
    { email: "admin@greenfieldschool.example", name: "Priya Deshmukh", role: "school_admin" },
    { email: "hr@greenfieldschool.example", name: "Aditi Rao", role: "hr" },
    { email: "hrstaff@greenfieldschool.example", name: "Nikhil Joshi", role: "hr_staff" },
    { email: "principal@greenfieldschool.example", name: "Vikram Rao", role: "principal" },
    { email: "accountant@greenfieldschool.example", name: "Anjali Bhatt", role: "accountant" },
    { email: "teacher@greenfieldschool.example", name: "Meera Kulkarni", role: "teacher" },
  ];

  for (const account of demoAccounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { passwordHash: hashPassword(DEMO_PASSWORD) },
      create: {
        name: account.name,
        email: account.email,
        isActive: true,
        passwordHash: hashPassword(DEMO_PASSWORD),
      },
    });
    await prisma.schoolMembership.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId: school.id } },
      update: { role: account.role },
      create: { userId: user.id, schoolId: school.id, role: account.role },
    });
  }

  // Demo parent/student portal logins, for exercising the portal locally
  // (PARENT-STUDENT-PORTAL-ROADMAP.md Phase A-C). Linked to the first two
  // seeded students (ADM001, ADM002) so the demo parent also has something to
  // switch between.
  const portalStudents = await prisma.student.findMany({
    where: { schoolId: school.id, admissionNumber: { in: ["ADM001", "ADM002"] } },
    include: { guardians: { include: { guardian: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { admissionNumber: "asc" },
  });

  const [firstStudent] = portalStudents;
  if (firstStudent) {
    const studentUser = await prisma.user.upsert({
      where: { email: "student@greenfieldschool.example" },
      update: { passwordHash: hashPassword(DEMO_PASSWORD) },
      create: {
        name: `${firstStudent.firstName} ${firstStudent.lastName}`,
        email: "student@greenfieldschool.example",
        isActive: true,
        passwordHash: hashPassword(DEMO_PASSWORD),
      },
    });
    await prisma.schoolMembership.upsert({
      where: { userId_schoolId: { userId: studentUser.id, schoolId: school.id } },
      update: { role: "student" },
      create: { userId: studentUser.id, schoolId: school.id, role: "student" },
    });
    await prisma.student.update({ where: { id: firstStudent.id }, data: { userId: studentUser.id } });

    const primaryGuardianLink = firstStudent.guardians.find((g) => g.isPrimary) ?? firstStudent.guardians[0];
    if (primaryGuardianLink) {
      const parentUser = await prisma.user.upsert({
        where: { email: "parent@greenfieldschool.example" },
        update: { passwordHash: hashPassword(DEMO_PASSWORD) },
        create: {
          name: primaryGuardianLink.guardian.fullName,
          email: "parent@greenfieldschool.example",
          isActive: true,
          passwordHash: hashPassword(DEMO_PASSWORD),
        },
      });
      await prisma.schoolMembership.upsert({
        where: { userId_schoolId: { userId: parentUser.id, schoolId: school.id } },
        update: { role: "parent" },
        create: { userId: parentUser.id, schoolId: school.id, role: "parent" },
      });
      await prisma.guardian.update({ where: { id: primaryGuardianLink.guardianId }, data: { userId: parentUser.id } });
      await prisma.studentGuardian.update({ where: { id: primaryGuardianLink.id }, data: { canAccessPortal: true } });

      // Also link this same guardian to the second seeded student, so the
      // demo parent has more than one child to switch between.
      const secondStudent = portalStudents[1];
      if (secondStudent) {
        const existingLink = await prisma.studentGuardian.findUnique({
          where: { studentId_guardianId: { studentId: secondStudent.id, guardianId: primaryGuardianLink.guardianId } },
        });
        if (existingLink) {
          await prisma.studentGuardian.update({ where: { id: existingLink.id }, data: { canAccessPortal: true } });
        } else {
          await prisma.studentGuardian.create({
            data: {
              studentId: secondStudent.id,
              guardianId: primaryGuardianLink.guardianId,
              relationship: primaryGuardianLink.relationship,
              canAccessPortal: true,
            },
          });
        }
      }
    }
  }

  const employeeTypeSeed = [
    { name: "Permanent", code: "PERMANENT", isPaid: true, sortOrder: 0 },
    { name: "Contract", code: "CONTRACT", isPaid: true, sortOrder: 1 },
    { name: "Part-time", code: "PART_TIME", isPaid: true, sortOrder: 2 },
    { name: "Visiting Faculty", code: "VISITING", isPaid: true, sortOrder: 3 },
    { name: "Intern", code: "INTERN", isPaid: false, sortOrder: 4 },
  ];
  const employeeTypeIds = new Map<string, string>();
  for (const type of employeeTypeSeed) {
    const row = await prisma.employeeType.upsert({
      where: { schoolId_code: { schoolId: school.id, code: type.code } },
      update: {},
      create: { schoolId: school.id, ...type },
    });
    employeeTypeIds.set(type.code, row.id);
  }

  // Statuses and types are varied deliberately so the HR dashboard's breakdowns
  // and alerts have something real to show on a fresh database.
  const teacherSeed = [
    { first: "Meera", last: "Kulkarni", designation: "Mathematics Teacher", dept: "Academics", type: "PERMANENT", status: "active", gender: "female" },
    { first: "Rakesh", last: "Iyer", designation: "Science Teacher", dept: "Academics", type: "PERMANENT", status: "active", gender: "male" },
    { first: "Sunita", last: "Desai", designation: "English Teacher", dept: "Academics", type: "CONTRACT", status: "probation", gender: "female" },
  ];
  const staffSeed = [
    { first: "Vikram", last: "Rao", designation: "Principal", category: "principal", dept: "Administration", type: "PERMANENT", status: "active", gender: "male" },
    { first: "Anjali", last: "Bhatt", designation: "Accountant", category: "accountant", dept: "Finance", type: "PERMANENT", status: "active", gender: "female" },
    { first: "Suresh", last: "Pillai", designation: "Librarian", category: "librarian", dept: "Library", type: "PERMANENT", status: "on_leave", gender: "male" },
    { first: "Ramesh", last: "Chawla", designation: "Bus Driver", category: "driver", dept: "Transport", type: "CONTRACT", status: "active", gender: "male" },
    { first: "Farida", last: "Sheikh", designation: "Front Office Executive", category: "admin_staff", dept: "Administration", type: "PART_TIME", status: "notice_period", gender: "female" },
    { first: "Kamala", last: "Devi", designation: "Housekeeping Supervisor", category: "support_staff", dept: "Housekeeping", type: "PERMANENT", status: "active", gender: "female" },
    { first: "Gopal", last: "Yadav", designation: "Security Guard", category: "security", dept: "Housekeeping", type: "CONTRACT", status: "active", gender: "male" },
  ];

  /**
   * Departments carry a real type rather than defaulting everything to
   * "academic" — Finance, Library and Transport are not academic departments,
   * and the dashboard groups by this.
   */
  const DEPARTMENT_TYPES_BY_NAME: Record<string, string> = {
    Academics: "academic",
    Administration: "administration",
    Finance: "finance",
    Library: "library",
    Transport: "transport",
    Housekeeping: "support",
    HR: "hr",
    IT: "it",
  };

  const departmentIds = new Map<string, string>();
  async function departmentId(name: string): Promise<string> {
    if (departmentIds.has(name)) return departmentIds.get(name)!;
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20);
    const departmentType = DEPARTMENT_TYPES_BY_NAME[name] ?? "other";
    const dept = await prisma.department.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      // Corrects departments seeded before types were set.
      update: { departmentType },
      create: { schoolId: school.id, name, code, departmentType },
    });
    departmentIds.set(name, dept.id);
    return dept.id;
  }

  // Seed departments unconditionally. The staff block below is skipped once
  // staff exist, so leaving this to it would never correct a database seeded
  // before departments carried a type.
  for (const name of Object.keys(DEPARTMENT_TYPES_BY_NAME)) {
    await departmentId(name);
  }

  const designationIds = new Map<string, string>();
  async function designationId(name: string): Promise<string> {
    if (designationIds.has(name)) return designationIds.get(name)!;
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20);
    const role = await prisma.designation.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      update: {},
      create: { schoolId: school.id, name, code },
    });
    designationIds.set(name, role.id);
    return role.id;
  }

  const existingStaff = await prisma.staff.count({ where: { schoolId: school.id } });
  if (existingStaff === 0) {
    let seq = 1;
    const today = new Date();

    for (const t of teacherSeed) {
      await prisma.staff.create({
        data: {
          schoolId: school.id,
          employeeId: `EMP-${String(seq++).padStart(6, "0")}`,
          fullName: `${t.first} ${t.last}`,
          firstName: t.first,
          lastName: t.last,
          gender: t.gender,
          designationId: await designationId(t.designation),
          departmentId: await departmentId(t.dept),
          employeeTypeId: employeeTypeIds.get(t.type),
          category: "teacher",
          mobileNumber: `+91 90${String(2000000 + seq * 91).slice(0, 8)}`,
          // Spread birthdays across the coming weeks so the dashboard's
          // "upcoming" panel isn't empty on a fresh install.
          dateOfBirth: new Date(1988, today.getMonth(), Math.min(28, today.getDate() + seq * 3)),
          joiningDate: new Date(2019, seq % 12, 1),
          employmentStatus: t.status,
        },
      });
    }

    for (const s of staffSeed) {
      await prisma.staff.create({
        data: {
          schoolId: school.id,
          employeeId: `EMP-${String(seq++).padStart(6, "0")}`,
          fullName: `${s.first} ${s.last}`,
          firstName: s.first,
          lastName: s.last,
          gender: s.gender,
          designationId: await designationId(s.designation),
          departmentId: await departmentId(s.dept),
          employeeTypeId: employeeTypeIds.get(s.type),
          category: s.category,
          mobileNumber: `+91 90${String(2000000 + seq * 91).slice(0, 8)}`,
          dateOfBirth: new Date(1985, today.getMonth(), Math.min(28, today.getDate() + seq * 2)),
          joiningDate: new Date(2018, today.getMonth(), 1),
          employmentStatus: s.status,
        },
      });
    }
  }

  // Teacher-scope demo data: link the teacher demo login to a real Staff
  // record, make her the class teacher of one section, and a subject
  // teacher for two other classes — the two access levels the "My Classes &
  // Subjects" teacher portal (and the admin "Teacher Access" overview) are
  // built around. Independent of the `existingStaff === 0` guard above so
  // re-running seed on an older database still fixes the link.
  const mathsSubject = await prisma.subject.upsert({
    where: { schoolId_code: { schoolId: school.id, code: "MATH" } },
    update: {},
    create: {
      schoolId: school.id,
      name: "Mathematics",
      code: "MATH",
      subjectType: "core",
      natureType: "theory",
      maxMarks: 100,
      passingMarks: 33,
    },
  });

  const meeraStaff = await prisma.staff.findFirst({ where: { schoolId: school.id, firstName: "Meera", lastName: "Kulkarni" } });
  const teacherUser = await prisma.user.findUnique({ where: { email: "teacher@greenfieldschool.example" } });

  if (meeraStaff && teacherUser) {
    if (meeraStaff.userId !== teacherUser.id) {
      await prisma.staff.update({ where: { id: meeraStaff.id }, data: { userId: teacherUser.id } });
    }

    const class6 = classes.find((c) => c.name === "Class 6");
    const sectionA = class6 ? (sectionsByClass.get(class6.id) ?? []).find((s) => s.name === "A") : undefined;
    if (sectionA) {
      await prisma.section.update({ where: { id: sectionA.id }, data: { classTeacherId: meeraStaff.id } });
    }

    for (const className of ["Class 7", "Class 8"]) {
      const cls = classes.find((c) => c.name === className);
      if (!cls) continue;
      const existingAssignment = await prisma.subjectAssignment.findFirst({
        where: { subjectId: mathsSubject.id, academicYearId: academicYear.id, classId: cls.id, sectionId: null },
      });
      if (!existingAssignment) {
        await prisma.subjectAssignment.create({
          data: {
            schoolId: school.id,
            subjectId: mathsSubject.id,
            academicYearId: academicYear.id,
            classId: cls.id,
            sectionId: null,
            teacherId: meeraStaff.id,
          },
        });
      }
    }
  }

  await seedSystemTemplates();
  await seedCertificateTypesAndTemplates();

  console.log(`Seeded ${school.name}: ${classes.length} classes, 20 students, 8 staff (3 teachers + 5 staff).`);
  console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD}):`);
  console.log(`  ${"super_admin".padEnd(13)} superadmin@classlane.app (sign in at /super-admin/login)`);
  for (const account of demoAccounts) {
    console.log(`  ${account.role.padEnd(13)} ${account.email}`);
  }
}

interface ElementSeed {
  side: "front" | "back";
  type: string;
  fieldKey?: string;
  content?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  zIndex?: number;
}

/** Shared back layout: every template documents the same information, just restyled. */
function backElements(accentColor: string): ElementSeed[] {
  return [
    { side: "back", type: "text", content: "Emergency Information", x: 5, y: 4, width: 76, height: 5, fontSize: 6, fontWeight: "bold", color: accentColor },
    { side: "back", type: "dynamic_field", fieldKey: "student.guardianName", x: 5, y: 10, width: 76, height: 5, fontSize: 6 },
    { side: "back", type: "dynamic_field", fieldKey: "student.guardianPhone", x: 5, y: 16, width: 76, height: 5, fontSize: 6 },
    { side: "back", type: "dynamic_field", fieldKey: "student.address", x: 5, y: 22, width: 76, height: 8, fontSize: 5.5 },
    { side: "back", type: "text", content: "If found, please return to the school office below.", x: 5, y: 31, width: 76, height: 5, fontSize: 5, color: "#6b7280" },
    { side: "back", type: "dynamic_field", fieldKey: "school.phone", x: 5, y: 37, width: 40, height: 5, fontSize: 5.5 },
    { side: "back", type: "dynamic_field", fieldKey: "school.website", x: 45, y: 37, width: 36, height: 5, fontSize: 5.5 },
    { side: "back", type: "signature", fieldKey: "school.principalSignature", x: 5, y: 44, width: 26, height: 8 },
    { side: "back", type: "text", content: "Principal", x: 5, y: 52, width: 26, height: 4, fontSize: 4.5, color: "#6b7280" },
    { side: "back", type: "qrcode", x: 60, y: 40, width: 16, height: 16 },
  ];
}

const SYSTEM_TEMPLATES: {
  name: string;
  orientation: "portrait" | "landscape";
  cardWidthMm: number;
  cardHeightMm: number;
  front: ElementSeed[];
}[] = [
  {
    name: "Modern Blue",
    orientation: "landscape",
    cardWidthMm: 85.6,
    cardHeightMm: 53.98,
    front: [
      { side: "front", type: "shape", x: 0, y: 0, width: 85.6, height: 15, backgroundColor: "#1d4ed8", zIndex: 0 },
      { side: "front", type: "logo", fieldKey: "school.logo", x: 4, y: 2.5, width: 10, height: 10, zIndex: 2 },
      { side: "front", type: "dynamic_field", fieldKey: "school.name", x: 16, y: 3, width: 66, height: 6, fontSize: 8, fontWeight: "bold", color: "#ffffff", zIndex: 2 },
      { side: "front", type: "text", content: "STUDENT IDENTITY CARD", x: 16, y: 9, width: 66, height: 4, fontSize: 4.5, color: "#dbeafe", zIndex: 2 },
      { side: "front", type: "photo", fieldKey: "student.photo", x: 5, y: 19, width: 22, height: 28, backgroundColor: "#e5e7eb", zIndex: 1 },
      { side: "front", type: "dynamic_field", fieldKey: "student.name", x: 30, y: 18, width: 51, height: 6, fontSize: 7.5, fontWeight: "bold", color: "#111827" },
      { side: "front", type: "dynamic_field", fieldKey: "student.admissionNumber", x: 30, y: 25, width: 24, height: 5, fontSize: 6, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.class", x: 55, y: 25, width: 13, height: 5, fontSize: 6, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.section", x: 69, y: 25, width: 12, height: 5, fontSize: 6, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.dateOfBirth", x: 30, y: 31, width: 30, height: 5, fontSize: 6, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.bloodGroup", x: 30, y: 37, width: 30, height: 5, fontSize: 6, color: "#374151" },
      { side: "front", type: "qrcode", x: 62, y: 34, width: 18, height: 18 },
      { side: "front", type: "dynamic_field", fieldKey: "academicYear.label", x: 5, y: 48, width: 76, height: 4, fontSize: 4.5, color: "#6b7280", textAlign: "center" },
    ],
  },
  {
    name: "Classic School",
    orientation: "landscape",
    cardWidthMm: 85.6,
    cardHeightMm: 53.98,
    front: [
      { side: "front", type: "shape", x: 0, y: 0, width: 85.6, height: 53.98, backgroundColor: "#fffdf7", zIndex: 0 },
      { side: "front", type: "shape", x: 0, y: 0, width: 85.6, height: 3, backgroundColor: "#7f1d1d", zIndex: 1 },
      { side: "front", type: "logo", fieldKey: "school.logo", x: 36.8, y: 4, width: 12, height: 12, zIndex: 2 },
      { side: "front", type: "qrcode", x: 66, y: 4, width: 15, height: 15 },
      { side: "front", type: "photo", fieldKey: "student.photo", x: 30.8, y: 17, width: 24, height: 21, backgroundColor: "#f3f4f6", zIndex: 1 },
      { side: "front", type: "dynamic_field", fieldKey: "school.name", x: 5, y: 39, width: 76, height: 4.5, fontSize: 6.5, fontWeight: "bold", color: "#7f1d1d", textAlign: "center" },
      { side: "front", type: "dynamic_field", fieldKey: "student.name", x: 5, y: 43.2, width: 76, height: 4.5, fontSize: 6, fontWeight: "bold", color: "#111827", textAlign: "center" },
      { side: "front", type: "dynamic_field", fieldKey: "student.admissionNumber", x: 5, y: 47.4, width: 38, height: 4, fontSize: 5, color: "#374151", textAlign: "center" },
      { side: "front", type: "dynamic_field", fieldKey: "student.class", x: 43, y: 47.4, width: 19, height: 4, fontSize: 5, color: "#374151", textAlign: "center" },
      { side: "front", type: "dynamic_field", fieldKey: "student.section", x: 62, y: 47.4, width: 19, height: 4, fontSize: 5, color: "#374151", textAlign: "center" },
    ],
  },
  {
    name: "Minimal Professional",
    orientation: "landscape",
    cardWidthMm: 85.6,
    cardHeightMm: 53.98,
    front: [
      { side: "front", type: "shape", x: 0, y: 0, width: 85.6, height: 53.98, backgroundColor: "#ffffff", zIndex: 0 },
      { side: "front", type: "shape", x: 0, y: 0, width: 5, height: 53.98, backgroundColor: "#111827", zIndex: 1 },
      { side: "front", type: "photo", fieldKey: "student.photo", x: 9, y: 8, width: 22, height: 28, backgroundColor: "#f3f4f6", zIndex: 1 },
      { side: "front", type: "logo", fieldKey: "school.logo", x: 9, y: 38, width: 10, height: 10, zIndex: 2 },
      { side: "front", type: "dynamic_field", fieldKey: "school.name", x: 34, y: 8, width: 47, height: 5, fontSize: 6, fontWeight: "bold", color: "#111827" },
      { side: "front", type: "text", content: "STUDENT ID", x: 34, y: 13, width: 47, height: 4, fontSize: 4, color: "#6b7280" },
      { side: "front", type: "dynamic_field", fieldKey: "student.name", x: 34, y: 20, width: 47, height: 5.5, fontSize: 6.5, fontWeight: "bold", color: "#111827" },
      { side: "front", type: "dynamic_field", fieldKey: "student.admissionNumber", x: 34, y: 26, width: 24, height: 4.5, fontSize: 5, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.class", x: 34, y: 31, width: 24, height: 4.5, fontSize: 5, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.section", x: 34, y: 36, width: 24, height: 4.5, fontSize: 5, color: "#374151" },
      { side: "front", type: "dynamic_field", fieldKey: "student.bloodGroup", x: 34, y: 41, width: 24, height: 4.5, fontSize: 5, color: "#374151" },
      { side: "front", type: "qrcode", x: 63, y: 29, width: 17, height: 17 },
    ],
  },
];

async function seedSystemTemplates() {
  const existing = await prisma.iDCardTemplate.count({ where: { isSystemTemplate: true } });
  if (existing > 0) return;

  for (const [index, tpl] of SYSTEM_TEMPLATES.entries()) {
    const elements = [...tpl.front, ...backElements(index === 0 ? "#1d4ed8" : index === 1 ? "#7f1d1d" : "#111827")];
    await prisma.iDCardTemplate.create({
      data: {
        schoolId: null,
        isSystemTemplate: true,
        name: tpl.name,
        category: "student",
        orientation: tpl.orientation,
        cardWidthMm: tpl.cardWidthMm,
        cardHeightMm: tpl.cardHeightMm,
        isActive: true,
        isDefault: index === 0,
        elements: {
          create: elements.map((el, zi) => ({
            side: el.side,
            type: el.type,
            fieldKey: el.fieldKey,
            content: el.content,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            textAlign: el.textAlign,
            color: el.color,
            backgroundColor: el.backgroundColor,
            zIndex: el.zIndex ?? zi,
          })),
        },
      },
    });
  }

  console.log(`Seeded ${SYSTEM_TEMPLATES.length} system ID card templates.`);
}

// ---------------------------------------------------------------------------
// Certificates: system certificate types + two ready-to-use A4 templates
// ---------------------------------------------------------------------------

const CERTIFICATE_TYPES: { key: string; name: string; category: "student" | "staff"; prefix: string; requiresApproval?: boolean }[] = [
  { key: "bonafide", name: "Bonafide Certificate", category: "student", prefix: "BON" },
  { key: "transfer_certificate", name: "Transfer Certificate", category: "student", prefix: "TC", requiresApproval: true },
  { key: "migration_certificate", name: "Migration Certificate", category: "student", prefix: "MIG", requiresApproval: true },
  { key: "character_certificate", name: "Character Certificate", category: "student", prefix: "CHAR" },
  { key: "study_certificate", name: "Study Certificate", category: "student", prefix: "STUDY" },
  { key: "school_leaving_certificate", name: "School Leaving Certificate", category: "student", prefix: "SLC", requiresApproval: true },
  { key: "conduct_certificate", name: "Conduct Certificate", category: "student", prefix: "COND" },
  { key: "attendance_certificate", name: "Attendance Certificate", category: "student", prefix: "ATT" },
  { key: "course_completion_certificate", name: "Course Completion Certificate", category: "student", prefix: "CCC" },
  { key: "merit_certificate", name: "Merit Certificate", category: "student", prefix: "MERIT" },
  { key: "achievement_certificate", name: "Achievement Certificate", category: "student", prefix: "ACH" },
  { key: "participation_certificate", name: "Participation Certificate", category: "student", prefix: "PART" },
  { key: "sports_certificate", name: "Sports Certificate", category: "student", prefix: "SPORT" },
  { key: "scholarship_certificate", name: "Scholarship Certificate", category: "student", prefix: "SCHOL" },
  { key: "fee_clearance_certificate", name: "Fee Payment / Clearance Certificate", category: "student", prefix: "FEE" },
  { key: "identity_certificate", name: "Identity / Enrollment Certificate", category: "student", prefix: "ID" },
  { key: "admission_confirmation_certificate", name: "Admission Confirmation Certificate", category: "student", prefix: "ADM" },
  { key: "gap_certificate", name: "Gap Certificate", category: "student", prefix: "GAP" },
  { key: "experience_certificate", name: "Experience Certificate", category: "staff", prefix: "EXP" },
  { key: "employment_certificate", name: "Employment Certificate", category: "staff", prefix: "EMPC" },
  { key: "appointment_letter", name: "Appointment Letter", category: "staff", prefix: "APPT" },
  { key: "offer_letter", name: "Offer Letter", category: "staff", prefix: "OFFER" },
  { key: "relieving_letter", name: "Relieving Letter", category: "staff", prefix: "RELV", requiresApproval: true },
  { key: "service_certificate", name: "Service Certificate", category: "staff", prefix: "SERV" },
  { key: "salary_certificate", name: "Salary Certificate", category: "staff", prefix: "SAL" },
  { key: "staff_bonafide_certificate", name: "Staff Bonafide Certificate", category: "staff", prefix: "SBON" },
  { key: "promotion_letter", name: "Promotion Letter", category: "staff", prefix: "PROM" },
  { key: "increment_letter", name: "Increment Letter", category: "staff", prefix: "INCR" },
];

async function seedCertificateTypesAndTemplates() {
  const existing = await prisma.certificateType.count({ where: { isSystemType: true } });
  if (existing === 0) {
    await prisma.certificateType.createMany({
      data: CERTIFICATE_TYPES.map((t) => ({
        schoolId: null,
        key: t.key,
        name: t.name,
        category: t.category,
        numberingPrefix: t.prefix,
        requiresApproval: Boolean(t.requiresApproval),
        isSystemType: true,
        isActive: true,
      })),
    });
    console.log(`Seeded ${CERTIFICATE_TYPES.length} system certificate types.`);
  }

  const existingTemplates = await prisma.certificateTemplate.count({ where: { isSystemTemplate: true } });
  if (existingTemplates > 0) return;

  const bonafideType = await prisma.certificateType.findFirst({ where: { key: "bonafide", isSystemType: true } });
  const tcType = await prisma.certificateType.findFirst({ where: { key: "transfer_certificate", isSystemType: true } });
  if (!bonafideType || !tcType) return;

  const labelValueRow = (label: string, fieldKey: string, y: number): ElementSeed[] => [
    { side: "front", type: "text", content: label, x: 25, y, width: 40, height: 5.5, fontSize: 5.5, color: "#374151" },
    { side: "front", type: "dynamic_field", fieldKey, x: 68, y, width: 100, height: 5.5, fontSize: 5.5, fontWeight: "bold", color: "#111827" },
  ];

  await prisma.certificateTemplate.create({
    data: {
      schoolId: null,
      isSystemTemplate: true,
      certificateTypeId: bonafideType.id,
      name: "Classic Bonafide",
      pageWidthMm: 210,
      pageHeightMm: 297,
      orientation: "portrait",
      isDefault: true,
      isActive: true,
      elements: {
        create: [
          { side: "front", type: "shape", x: 0, y: 0, width: 210, height: 297, backgroundColor: "#ffffff", zIndex: 0 },
          { side: "front", type: "logo", fieldKey: "school.logo", x: 90, y: 12, width: 30, height: 22, zIndex: 2 },
          { side: "front", type: "dynamic_field", fieldKey: "school.name", x: 20, y: 36, width: 170, height: 9, fontSize: 10, fontWeight: "bold", textAlign: "center", color: "#111827" },
          { side: "front", type: "dynamic_field", fieldKey: "school.address", x: 20, y: 45, width: 170, height: 6, fontSize: 5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "text", content: "BONAFIDE CERTIFICATE", x: 20, y: 62, width: 170, height: 9, fontSize: 12, fontWeight: "bold", textAlign: "center", color: "#111827" },
          { side: "front", type: "dynamic_field", fieldKey: "certificate.number", x: 20, y: 76, width: 80, height: 5, fontSize: 5, color: "#6b7280" },
          { side: "front", type: "dynamic_field", fieldKey: "certificate.issueDate", x: 110, y: 76, width: 80, height: 5, fontSize: 5, textAlign: "right", color: "#6b7280" },
          { side: "front", type: "text", content: "This is to certify that", x: 20, y: 95, width: 170, height: 6, fontSize: 6, textAlign: "center", color: "#374151" },
          { side: "front", type: "dynamic_field", fieldKey: "student.name", x: 20, y: 103, width: 170, height: 8, fontSize: 9, fontWeight: "bold", textAlign: "center", color: "#111827" },
          { side: "front", type: "text", content: "son/daughter/ward of", x: 20, y: 113, width: 170, height: 6, fontSize: 6, textAlign: "center", color: "#374151" },
          { side: "front", type: "dynamic_field", fieldKey: "student.guardianName", x: 20, y: 121, width: 170, height: 7, fontSize: 7, fontWeight: "bold", textAlign: "center", color: "#111827" },
          ...labelValueRow("Admission Number:", "student.admissionNumber", 138),
          ...labelValueRow("Class & Section:", "student.class", 146),
          ...labelValueRow("Academic Year:", "academicYear.label", 154),
          ...labelValueRow("Date of Birth:", "student.dateOfBirth", 162),
          {
            side: "front",
            type: "text",
            content: "is a bonafide student of this institution and is presently studying here. This certificate is issued upon request for the purpose it may be required.",
            x: 20,
            y: 176,
            width: 170,
            height: 20,
            fontSize: 6,
            color: "#374151",
          },
          { side: "front", type: "signature", x: 25, y: 245, width: 45, height: 15 },
          { side: "front", type: "text", content: "Class Teacher", x: 25, y: 262, width: 45, height: 5, fontSize: 5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "signature", x: 140, y: 245, width: 45, height: 15 },
          { side: "front", type: "dynamic_field", fieldKey: "school.principalName", x: 140, y: 262, width: 45, height: 4.5, fontSize: 5, textAlign: "center", color: "#111827" },
          { side: "front", type: "text", content: "Principal", x: 140, y: 267, width: 45, height: 5, fontSize: 4.5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "qrcode", x: 175, y: 275, width: 22, height: 22 },
        ].map((el, zi) => ({ ...el, zIndex: zi })),
      },
    },
  });

  await prisma.certificateTemplate.create({
    data: {
      schoolId: null,
      isSystemTemplate: true,
      certificateTypeId: tcType.id,
      name: "Standard Transfer Certificate",
      pageWidthMm: 210,
      pageHeightMm: 297,
      orientation: "portrait",
      isDefault: true,
      isActive: true,
      elements: {
        create: [
          { side: "front", type: "shape", x: 0, y: 0, width: 210, height: 297, backgroundColor: "#ffffff", zIndex: 0 },
          { side: "front", type: "logo", fieldKey: "school.logo", x: 90, y: 10, width: 30, height: 22, zIndex: 2 },
          { side: "front", type: "dynamic_field", fieldKey: "school.name", x: 20, y: 34, width: 170, height: 9, fontSize: 10, fontWeight: "bold", textAlign: "center", color: "#111827" },
          { side: "front", type: "dynamic_field", fieldKey: "school.affiliationBoard", x: 20, y: 43, width: 170, height: 5, fontSize: 5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "text", content: "TRANSFER CERTIFICATE", x: 20, y: 58, width: 170, height: 9, fontSize: 12, fontWeight: "bold", textAlign: "center", color: "#111827" },
          { side: "front", type: "dynamic_field", fieldKey: "certificate.number", x: 20, y: 72, width: 80, height: 5, fontSize: 5, color: "#6b7280" },
          { side: "front", type: "dynamic_field", fieldKey: "certificate.issueDate", x: 110, y: 72, width: 80, height: 5, fontSize: 5, textAlign: "right", color: "#6b7280" },
          ...labelValueRow("Student Name:", "student.name", 86),
          ...labelValueRow("Admission Number:", "student.admissionNumber", 94),
          ...labelValueRow("Father's/Guardian's Name:", "student.guardianName", 102),
          ...labelValueRow("Date of Birth:", "student.dateOfBirth", 110),
          ...labelValueRow("Date of Admission:", "student.admissionDate", 118),
          ...labelValueRow("Class & Section:", "student.class", 126),
          ...labelValueRow("Previous School:", "student.previousSchool", 134),
          ...labelValueRow("Academic Year:", "academicYear.label", 142),
          {
            side: "front",
            type: "text",
            content: "The above-named student has been on the rolls of this institution and is hereby granted a transfer certificate. All dues have been cleared and conduct during the period of study was satisfactory.",
            x: 20,
            y: 156,
            width: 170,
            height: 20,
            fontSize: 6,
            color: "#374151",
          },
          { side: "front", type: "signature", x: 25, y: 245, width: 45, height: 15 },
          { side: "front", type: "text", content: "Class Teacher", x: 25, y: 262, width: 45, height: 5, fontSize: 5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "signature", x: 140, y: 245, width: 45, height: 15 },
          { side: "front", type: "dynamic_field", fieldKey: "school.principalName", x: 140, y: 262, width: 45, height: 4.5, fontSize: 5, textAlign: "center", color: "#111827" },
          { side: "front", type: "text", content: "Principal", x: 140, y: 267, width: 45, height: 5, fontSize: 4.5, textAlign: "center", color: "#6b7280" },
          { side: "front", type: "qrcode", x: 175, y: 275, width: 22, height: 22 },
        ].map((el, zi) => ({ ...el, zIndex: zi })),
      },
    },
  });

  console.log("Seeded 2 system certificate templates (Bonafide, Transfer Certificate).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
