import { supabase } from './supabase';

interface SmsPayload {
  absenceId: string;
  userId: string;
  phone: string;
  message: string;
}

// Stub: logs to console and records in DB.
// Replace with Twilio client when credentials are available.
export async function sendSms(payload: SmsPayload): Promise<void> {
  console.log(`[SMS STUB] → ${payload.phone}: ${payload.message}`);

  await supabase.from('sms_notifications').insert({
    absence_id: payload.absenceId,
    user_id: payload.userId,
    phone: payload.phone,
    message: payload.message,
    status: 'sent',
    sent_at: new Date().toISOString(),
  });
}

export function buildAbsenceMessage(opts: {
  kindergartenName: string;
  date: string;
  claimUrl: string;
}): string {
  return `מחליפון: נפתחה היעדרות ב${opts.kindergartenName} לתאריך ${opts.date}. לתפיסת המשמרת: ${opts.claimUrl}`;
}
