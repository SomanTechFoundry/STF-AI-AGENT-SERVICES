/**
 * Database seed script.
 *
 * Creates initial demo data for local development.
 * Run with: npm run db:seed
 *
 * NEVER run this against production.
 */

import { PrismaClient, BusinessIndustry, DayOfWeek } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database. Aborting.");
  }

  // ---- Demo Business: Sunset Salon ----
  const business = await prisma.business.upsert({
    where: { slug: "sunset-salon" },
    update: {},
    create: {
      name: "Sunset Salon",
      slug: "sunset-salon",
      industry: BusinessIndustry.SALON,
      email: "hello@sunsetsalon.example",
      phone: "+12145550100",
      address: "123 Main St",
      city: "Dallas",
      state: "TX",
      postalCode: "75201",
      country: "US",
      timezone: "America/Chicago",
      bookingLeadTimeMinutes: 60,
      bookingMaxDaysAhead: 45,
      cancellationPolicyHours: 24,
    },
  });

  console.log(`Business created: ${business.name} (${business.id})`);

  // ---- Business Hours ----
  const hours: Array<{
    dayOfWeek: DayOfWeek;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }> = [
    { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: "09:00", closeTime: "18:00" },
    { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: "09:00", closeTime: "18:00" },
    { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: "09:00", closeTime: "18:00" },
    { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: "09:00", closeTime: "20:00" },
    { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: "09:00", closeTime: "20:00" },
    { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: "10:00", closeTime: "17:00" },
    { dayOfWeek: DayOfWeek.SUNDAY, isOpen: false, openTime: "00:00", closeTime: "00:00" },
  ];

  for (const h of hours) {
    await prisma.businessHours.upsert({
      where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek: h.dayOfWeek } },
      update: h,
      create: { businessId: business.id, ...h },
    });
  }

  // ---- Services ----
  const services = [
    { name: "Women's Haircut", durationMinutes: 60, price: 65, category: "Hair" },
    { name: "Men's Haircut", durationMinutes: 30, price: 35, category: "Hair" },
    { name: "Blowout", durationMinutes: 45, price: 50, category: "Hair" },
    { name: "Hair Color - Full", durationMinutes: 120, price: 140, category: "Color" },
    { name: "Hair Color - Partial", durationMinutes: 90, price: 95, category: "Color" },
    { name: "Highlights", durationMinutes: 120, price: 130, category: "Color" },
    { name: "Deep Conditioning Treatment", durationMinutes: 30, price: 45, category: "Treatment" },
    { name: "Brazilian Blowout", durationMinutes: 180, price: 250, category: "Treatment" },
  ];

  const createdServices = [];
  for (const s of services) {
    const service = await prisma.service.upsert({
      where: {
        id: `seed-${business.id}-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: {},
      create: {
        id: `seed-${business.id}-${s.name.toLowerCase().replace(/\s+/g, "-")}`,
        businessId: business.id,
        name: s.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
        category: s.category,
      },
    });
    createdServices.push(service);
  }

  console.log(`Created ${createdServices.length} services`);

  // ---- Staff ----
  const staffMembers = [
    { name: "Maria Garcia", title: "Senior Stylist", email: "maria@sunsetsalon.example" },
    { name: "James Wilson", title: "Barber & Stylist", email: "james@sunsetsalon.example" },
    { name: "Aisha Johnson", title: "Color Specialist", email: "aisha@sunsetsalon.example" },
  ];

  for (const s of staffMembers) {
    await prisma.staff.upsert({
      where: { businessId_email: { businessId: business.id, email: s.email } },
      update: {},
      create: {
        businessId: business.id,
        name: s.name,
        title: s.title,
        email: s.email,
      },
    });
  }

  // ---- AI Configuration ----
  await prisma.aIConfiguration.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      agentName: "Sunny",
      agentPersonality:
        "Friendly, professional, and helpful. Speaks naturally and concisely. " +
        "Always confirms details before booking. Warmly greets returning customers.",
      aiProvider: "gemini",
      aiModel: "gemini-1.5-flash",
      humanHandoffEnabled: true,
      humanHandoffPhone: "+12145550100",
      welcomeMessage:
        "Hi! I'm Sunny, the AI receptionist at Sunset Salon. " +
        "I can help you book an appointment, answer questions about our services, " +
        "or check your upcoming appointments. How can I help you today?",
    },
  });

  // ---- Sample FAQ Knowledge Items ----
  const faqs = [
    {
      category: "faq",
      question: "Where are you located?",
      answer: "We're at 123 Main St, Dallas, TX 75201.",
    },
    {
      category: "policy",
      question: "What is your cancellation policy?",
      answer:
        "We ask for at least 24 hours notice for cancellations. " +
        "Late cancellations or no-shows may be subject to a fee.",
    },
    {
      category: "faq",
      question: "Do you accept walk-ins?",
      answer:
        "We primarily work by appointment to ensure you get the best service, " +
        "but we do try to accommodate walk-ins when possible. We recommend booking ahead.",
    },
    {
      category: "faq",
      question: "What forms of payment do you accept?",
      answer: "We accept cash, all major credit cards, and Apple Pay.",
    },
    {
      category: "faq",
      question: "How long does a color service take?",
      answer:
        "Full color typically takes about 2 hours. Highlights take about 2 hours. " +
        "Partial color is usually around 90 minutes. We'll give you a more precise estimate at your appointment.",
    },
  ];

  for (const faq of faqs) {
    await prisma.knowledgeItem.create({
      data: {
        businessId: business.id,
        ...faq,
      },
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
