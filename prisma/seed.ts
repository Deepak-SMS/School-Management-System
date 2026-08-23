import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

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
  const school = await prisma.school.upsert({
    where: { id: "school_greenfield" },
    update: {},
    create: {
      id: "school_greenfield",
      name: "Greenfield International School",
      shortName: "Greenfield",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
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
      isCurrent: true,
    },
  });

  const classNames = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
  const classes = [];
  for (const [index, name] of classNames.entries()) {
    const cls = await prisma.class.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {},
      create: { schoolId: school.id, name, sortOrder: index },
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
        create: { schoolId: school.id, classId: cls.id, name },
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

  const teacherSeed = [
    { name: "Meera Kulkarni", designation: "Mathematics Teacher", dept: "Academics" },
    { name: "Rakesh Iyer", designation: "Science Teacher", dept: "Academics" },
    { name: "Sunita Desai", designation: "English Teacher", dept: "Academics" },
  ];
  const staffSeed = [
    { name: "Vikram Rao", designation: "Principal", category: "principal", dept: "Administration" },
    { name: "Anjali Bhatt", designation: "Accountant", category: "accountant", dept: "Finance" },
    { name: "Suresh Pillai", designation: "Librarian", category: "librarian", dept: "Library" },
    { name: "Ramesh Chawla", designation: "Bus Driver", category: "driver", dept: "Transport" },
    { name: "Farida Sheikh", designation: "Front Office Executive", category: "admin_staff", dept: "Administration" },
  ];

  const existingStaff = await prisma.staff.count({ where: { schoolId: school.id } });
  if (existingStaff === 0) {
    let seq = 1;
    for (const t of teacherSeed) {
      await prisma.staff.create({
        data: {
          schoolId: school.id,
          employeeId: `EMP${String(seq++).padStart(3, "0")}`,
          fullName: t.name,
          designation: t.designation,
          department: t.dept,
          category: "teacher",
          mobileNumber: `+91 90${String(2000000 + seq * 91).slice(0, 8)}`,
          joiningDate: new Date(2019, seq % 12, 1),
          employmentStatus: "active",
        },
      });
    }
    for (const s of staffSeed) {
      await prisma.staff.create({
        data: {
          schoolId: school.id,
          employeeId: `EMP${String(seq++).padStart(3, "0")}`,
          fullName: s.name,
          designation: s.designation,
          department: s.dept,
          category: s.category,
          mobileNumber: `+91 90${String(2000000 + seq * 91).slice(0, 8)}`,
          joiningDate: new Date(2018, seq % 12, 1),
          employmentStatus: "active",
        },
      });
    }
  }

  console.log(`Seeded ${school.name}: ${classes.length} classes, 20 students, 8 staff (3 teachers + 5 staff).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
