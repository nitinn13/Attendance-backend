// src/services/emailService.ts
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendPasswordResetEmail = async (email: string, resetCode: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Code - Attendance System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You requested to reset your password for your Attendance System account.</p>
        <p>Use the following code to reset your password:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
          <strong>${resetCode}</strong>
        </div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="color: #6b7280; font-size: 14px;">Attendance System - Secure Password Reset</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Failed to send reset email');
  }
};

// Generate a 6-digit numeric code
export const generateResetCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};