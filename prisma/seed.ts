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
          guardianName: `${pick(LAST_NAMES, i + 7)} ${i % 2 === 0 ? "Mr." : "Mrs."}`,
          guardianPhone: `+91 98${String(1000000 + i * 137).slice(0, 8)}`,
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
  ];

  const departmentIds = new Map<string, string>();
  async function departmentId(name: string): Promise<string> {
    if (departmentIds.has(name)) return departmentIds.get(name)!;
    const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20);
    const dept = await prisma.department.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      update: {},
      create: { schoolId: school.id, name, code },
    });
    departmentIds.set(name, dept.id);
    return dept.id;
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

  await seedSystemTemplates();

  console.log(`Seeded ${school.name}: ${classes.length} classes, 20 students, 8 staff (3 teachers + 5 staff).`);
  console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD}):`);
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

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
