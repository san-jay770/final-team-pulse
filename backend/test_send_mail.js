/**
 * TEAM PULSE — Live Gmail Sending Verification Script
 *
 * Run: node backend/test_send_mail.js [recipient_email]
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const emailService = require('./services/emailService');

async function testSend() {
  const targetEmail = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || process.env.EMAIL_USER;

  console.log('\n📧 Testing Live Email Delivery to Gmail Inbox...\n');
  console.log('Current Config:');
  console.log('  EMAIL_HOST     :', process.env.EMAIL_HOST || 'smtp.gmail.com');
  console.log('  EMAIL_PORT     :', process.env.EMAIL_PORT || '587');
  console.log('  EMAIL_USER     :', process.env.EMAIL_USER || process.env.SMTP_USER);
  console.log('  EMAIL_PASSWORD :', process.env.EMAIL_PASSWORD ? '••••••••••••••••' : '(NOT SET)');
  console.log('  Sending To     :', targetEmail);
  console.log('──────────────────────────────────────────────────\n');

  if (!process.env.EMAIL_PASSWORD || process.env.EMAIL_PASSWORD.includes('your-16-character')) {
    console.error('❌ Error: EMAIL_PASSWORD is not configured in .env!');
    console.log('\nTo fix this:');
    console.log('1. Go to your Google Account (myaccount.google.com)');
    console.log('2. Go to Security -> 2-Step Verification -> App Passwords');
    console.log('3. Create an app password for "Team Pulse"');
    console.log('4. Paste your 16-character password into backend/.env and .env:');
    console.log('   EMAIL_USER=your_gmail@gmail.com');
    console.log('   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx\n');
    return;
  }

  const dummyTask = {
    id: 999,
    title: 'Live Task Notification Verification',
    description: 'This is a live test email confirming that Team Pulse is successfully sending real emails to your Gmail inbox!',
    priority: 'High',
    status: 'Pending',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString()
  };

  const dummyUser = {
    name: 'Sanjay',
    email: targetEmail
  };

  console.log('Sending Task Created Email to Super Admin...');
  const res1 = await emailService.sendTaskCreatedToSuperAdmin(dummyUser, dummyTask, dummyUser, 'System Administrator');
  console.log('Result:', res1);

  console.log('\nSending Task Assigned Email to Member...');
  const res2 = await emailService.sendTaskAssignedEmail(dummyUser, dummyTask, 'System Administrator');
  console.log('Result:', res2);

  if (res1.success || res2.success) {
    console.log('\n🎉 SUCCESS! Check your Gmail inbox (and Spam folder if first time).');
  } else {
    console.log('\n⚠️ Email send failed. Please check credentials above.');
  }
}

testSend().catch(console.error);
