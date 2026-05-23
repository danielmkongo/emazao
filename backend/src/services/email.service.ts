import nodemailer from 'nodemailer'
import { env } from '../config/env'

const transporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_PORT === 465,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
})

export const sendOtpEmail = async (to: string, otp: string): Promise<void> => {
  if (!env.EMAIL_USER || !env.EMAIL_PASS) {
    console.warn(`[EMAIL] SMTP not configured — OTP for ${to}: ${otp}`)
    return
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: 'Your eMazao verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-block;background:#16A34A;border-radius:12px;padding:12px 16px">
            <span style="color:white;font-size:24px;font-weight:bold">eMazao</span>
          </div>
        </div>
        <h2 style="color:#111827;font-size:20px;margin-bottom:8px;text-align:center">Your verification code</h2>
        <p style="color:#6b7280;font-size:14px;text-align:center;margin-bottom:32px">
          Enter this code in the app to verify your account. It expires in 10 minutes.
        </p>
        <div style="background:white;border:2px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-family:monospace;font-size:40px;font-weight:bold;letter-spacing:10px;color:#111827">${otp}</span>
        </div>
        <p style="color:#9ca3af;font-size:12px;text-align:center">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
