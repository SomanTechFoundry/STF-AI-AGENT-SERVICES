/**
 * Resend appointment confirmation SMS (and optionally verify email config)
 * without going through chat again.
 *
 * Usage:
 *   node scripts/resend-confirmation.mjs
 *   node scripts/resend-confirmation.mjs <appointmentId>
 *
 * Requires an upgraded Twilio account to deliver custom SMS bodies.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";

function loadEnv(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
loadEnv(".env");
loadEnv(".env.local");

const prisma = new PrismaClient();

function utcToLocal(utcDate, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function formatDisplayDate(utcDate, timezone) {
  return utcDate.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayTime(time24) {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

async function main() {
  const argId = process.argv[2];
  let appointmentId = argId;

  if (!appointmentId) {
    const latest = await prisma.appointment.findFirst({
      where: { business: { slug: "sunset-salon" } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest) {
      console.error("No appointments found.");
      process.exit(1);
    }
    appointmentId = latest.id;
    console.log("Using latest appointment:", appointmentId);
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId },
    include: {
      service: { select: { name: true } },
      customer: { select: { name: true, phone: true, email: true, smsOptIn: true } },
      business: {
        select: {
          name: true,
          phone: true,
          timezone: true,
        },
      },
    },
  });

  if (!appt) {
    console.error("Appointment not found:", appointmentId);
    process.exit(1);
  }

  console.log("Customer:", {
    name: appt.customer.name,
    phone: appt.customer.phone,
    email: appt.customer.email,
    smsOptIn: appt.customer.smsOptIn,
  });

  if (!appt.customer.smsOptIn || !appt.customer.phone) {
    console.log("SMS skipped — missing phone or smsOptIn=false");
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.log("SMS skipped — Twilio not configured");
    return;
  }

  const local = utcToLocal(appt.startTime, appt.business.timezone);
  const displayDate = formatDisplayDate(appt.startTime, appt.business.timezone);
  const displayTime = formatDisplayTime(local.time);

  const body = [
    `Booking confirmed! ${appt.service.name} at ${appt.business.name}`,
    `Date: ${displayDate} at ${displayTime}`,
    appt.business.phone ? `Questions? Call ${appt.business.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  console.log("Sending SMS...", { to: appt.customer.phone, body });

  const client = twilio(sid, token);
  const msg = await client.messages.create({
    body,
    from,
    to: appt.customer.phone,
  });
  console.log("SMS OK:", msg.sid, msg.status);
}

main()
  .catch((err) => {
    console.error("SMS FAILED:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
