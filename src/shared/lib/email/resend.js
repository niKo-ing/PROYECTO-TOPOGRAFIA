import { Resend } from "resend";
import { getRequiredEnv } from "@/shared/lib/env";

let cachedResend = null;

function getResendClient() {
  if (cachedResend) return cachedResend;
  cachedResend = new Resend(getRequiredEnv("RESEND_API_KEY"));
  return cachedResend;
}

export async function sendCoordinatesCsvEmail({ to, subject, text, filename, csv }) {
  const resend = getResendClient();
  const from = "onboarding@resend.dev";
  const forcedTo = "nic.estefania@duocuc.cl";

  const { error } = await resend.emails.send({
    from,
    to: forcedTo,
    subject,
    text,
    attachments: [
      {
        filename,
        content: Buffer.from(csv, "utf8"),
        contentType: "text/csv",
      },
    ],
  });

  if (error) {
    throw new Error(`Error enviando email: ${error.message ?? "desconocido"}`);
  }
}
