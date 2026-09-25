/**
 * TEAM PULSE — Email Service (Resend API)
 *
 * All email functions accept data objects and send formatted HTML emails.
 * Resend API key is loaded from environment variables.
 */

require("dotenv").config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Resend sender
// For testing, use onboarding@resend.dev.
// For production, use an email address from your verified domain.
const fromAddress =
  process.env.RESEND_FROM ||
  process.env.EMAIL_FROM ||
  "Team Pulse <onboarding@resend.dev>";


// ─────────────────────────────────────────────
// Base Email Template
// ─────────────────────────────────────────────

function baseTemplate(title, body) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #F1F5F9;
      color: #0F172A;
    }

    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .header {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      padding: 28px 32px;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: #2563EB;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 16px;
      line-height: 40px;
      text-align: center;
    }

    .brand-name {
      color: white;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .content {
      padding: 32px;
    }

    .title {
      font-size: 22px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 16px;
    }

    .body-text {
      font-size: 15px;
      color: #475569;
      line-height: 1.7;
      margin-bottom: 24px;
    }

    .info-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E2E8F0;
      font-size: 14px;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      color: #64748B;
      font-weight: 500;
    }

    .info-value {
      color: #0F172A;
      font-weight: 600;
    }

    .footer {
      background: #F8FAFC;
      padding: 20px 32px;
      text-align: center;
      font-size: 13px;
      color: #94A3B8;
      border-top: 1px solid #E2E8F0;
    }
  </style>
</head>

<body>

  <div class="wrapper">

    <div class="header">
      <div class="header-brand">
        <div class="brand-icon">TP</div>
        <span class="brand-name">TEAM PULSE</span>
      </div>
    </div>

    <div class="content">
      ${body}
    </div>

    <div class="footer">
      <p>
        © ${new Date().getFullYear()}
        Team Pulse · Team Task Management & Performance System
      </p>

      <p style="margin-top:6px;">
        This is an automated notification from Team Pulse.
      </p>
    </div>

  </div>

</body>
</html>`;
}


// ─────────────────────────────────────────────
// Resend Attachment Converter
// ─────────────────────────────────────────────

function prepareAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments)) {
    return undefined;
  }

  return attachments.map((attachment) => {
    let content;

    if (Buffer.isBuffer(attachment.content)) {
      content = attachment.content.toString("base64");
    } else if (attachment.content instanceof Uint8Array) {
      content = Buffer.from(attachment.content).toString("base64");
    } else if (typeof attachment.content === "string") {
      content = Buffer.from(attachment.content).toString("base64");
    } else {
      content = "";
    }

    return {
      filename: attachment.filename || "attachment",
      content,
    };
  });
}


// ─────────────────────────────────────────────
// Core Send Function — Resend API
// ─────────────────────────────────────────────

async function sendEmail({ to, subject, html, attachments }) {

  const istTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  if (!RESEND_API_KEY) {

    console.error(
      "\n❌ [EMAIL ERROR] RESEND_API_KEY is not configured."
    );

    return {
      success: false,
      error: "RESEND_API_KEY is not configured",
    };
  }

  console.log(
    `\n⚡ [Email] Sending to "${to}" | Subject: "${subject}" ...`
  );

  try {

    const payload = {
      from: fromAddress,
      to: [to],
      subject,
      html,
    };

    const resendAttachments = prepareAttachments(attachments);

    if (resendAttachments && resendAttachments.length > 0) {
      payload.attachments = resendAttachments;
    }

    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {

      console.error(
        "╔═════════════════════════════════════════════════════════════╗"
      );

      console.error(
        "║ ❌ EMAIL DISPATCH FAILED                                    ║"
      );

      console.error(
        "╠═════════════════════════════════════════════════════════════╣"
      );

      console.error(
        `║ Time (IST) : ${istTime.padEnd(46)} ║`
      );

      console.error(
        `║ Recipient  : ${String(to).substring(0, 46).padEnd(46)} ║`
      );

      console.error(
        `║ Error      : ${String(
          result.message || result.error || "Resend API error"
        ).substring(0, 46).padEnd(46)} ║`
      );

      console.error(
        "╚═════════════════════════════════════════════════════════════╝\n"
      );

      return {
        success: false,
        error: result.message || result.error || "Resend API error",
      };
    }

    console.log(
      "╔═════════════════════════════════════════════════════════════╗"
    );

    console.log(
      "║ 📧 EMAIL DISPATCH SUCCESSFUL                                ║"
    );

    console.log(
      "╠═════════════════════════════════════════════════════════════╣"
    );

    console.log(
      `║ Time (IST) : ${istTime.padEnd(46)} ║`
    );

    console.log(
      `║ Recipient  : ${String(to).substring(0, 46).padEnd(46)} ║`
    );

    console.log(
      `║ From       : ${String(fromAddress)
        .substring(0, 46)
        .padEnd(46)} ║`
    );

    console.log(
      `║ Subject    : ${String(subject)
        .substring(0, 46)
        .padEnd(46)} ║`
    );

    console.log(
      `║ Resend ID  : ${String(result.id)
        .substring(0, 46)
        .padEnd(46)} ║`
    );

    console.log(
      "║ Status     : Accepted by Resend API                       ║"
    );

    console.log(
      "╚═════════════════════════════════════════════════════════════╝\n"
    );

    return {
      success: true,
      messageId: result.id,
    };

  } catch (err) {

    console.error(
      "╔═════════════════════════════════════════════════════════════╗"
    );

    console.error(
      "║ ❌ EMAIL DISPATCH FAILED                                    ║"
    );

    console.error(
      "╠═════════════════════════════════════════════════════════════╣"
    );

    console.error(
      `║ Time (IST) : ${istTime.padEnd(46)} ║`
    );

    console.error(
      `║ Recipient  : ${String(to).substring(0, 46).padEnd(46)} ║`
    );

    console.error(
      `║ Error      : ${String(err.message)
        .substring(0, 46)
        .padEnd(46)} ║`
    );

    console.error(
      "╚═════════════════════════════════════════════════════════════╝\n"
    );

    return {
      success: false,
      error: err.message,
    };
  }
}


// ─────────────────────────────────────────────
// Task Assigned
// ─────────────────────────────────────────────

async function sendTaskAssignedEmail(user, task, assignedBy) {

  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

  const html = baseTemplate(
    "New Task Assigned — Team Pulse",
    `
    <p class="title">📋 New Task Assigned to You</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
    </p>

    <p class="body-text">
      A new task has been assigned to you by
      <strong>${assignedBy || "Admin"}</strong>.
    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Task Title</span>
        <span class="info-value">${task.title}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Priority</span>
        <span class="info-value">${task.priority || "Medium"}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">${task.status || "Pending"}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Due Date</span>
        <span class="info-value">${dueDate}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Assigned By</span>
        <span class="info-value">${assignedBy || "Admin"}</span>
      </div>

      ${
        task.description
          ? `
          <div class="info-row"
               style="flex-direction:column;gap:4px;">

            <span class="info-label">Description</span>

            <span class="info-value"
                  style="font-weight:400;color:#475569;margin-top:4px;">
              ${task.description}
            </span>

          </div>
          `
          : ""
      }

    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `📋 New Task Assigned: "${task.title}" — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Task Created — Super Admin
// ─────────────────────────────────────────────

async function sendTaskCreatedToSuperAdmin(
  superAdmin,
  task,
  assignedUser,
  createdBy
) {

  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

  const html = baseTemplate(
    "Task Created Notification — Team Pulse",
    `
    <p class="title">✅ New Task Created in Team Pulse</p>

    <p class="body-text">
      Hi <strong>${superAdmin.name}</strong>,
    </p>

    <p class="body-text">
      A new task has just been registered in the system:
    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Task Title</span>
        <span class="info-value">${task.title}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Assigned To</span>
        <span class="info-value">
          ${
            assignedUser
              ? `${assignedUser.name} (${assignedUser.email})`
              : "Unassigned"
          }
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Created By</span>
        <span class="info-value">${createdBy}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Priority</span>
        <span class="info-value">${task.priority}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Due Date</span>
        <span class="info-value">${dueDate}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Task ID</span>
        <span class="info-value">#${task.id}</span>
      </div>

    </div>
    `
  );

  return sendEmail({
    to: superAdmin.email,
    subject: `✅ Task Created: "${task.title}" — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Task Reminder
// ─────────────────────────────────────────────

async function sendTaskReminderEmail(user, task, daysLeft) {

  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

  const html = baseTemplate(
    "Task Reminder — Team Pulse",
    `
    <p class="title">⏰ Task Due Reminder</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
    </p>

    <p class="body-text">
      Task <strong>"${task.title}"</strong>
      is due ${
        daysLeft === 0
          ? "today"
          : `in ${daysLeft} day(s)`
      }.
    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Task</span>
        <span class="info-value">${task.title}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Due Date</span>
        <span class="info-value">${dueDate}</span>
      </div>

    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `⏰ Task Reminder: "${task.title}" — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Overdue Task
// ─────────────────────────────────────────────

async function sendTaskOverdueEmail(user, task) {

  const html = baseTemplate(
    "Overdue Task Alert — Team Pulse",
    `
    <p class="title">🚨 Task Overdue Notice</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
    </p>

    <p class="body-text">
      Task <strong>"${task.title}"</strong>
      is past its due date.
      Please update the status.
    </p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `🚨 OVERDUE Task: "${task.title}" — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// New Doubt
// ─────────────────────────────────────────────

async function sendDoubtNotificationEmail(
  admin,
  doubt,
  submittedBy
) {

  const html = baseTemplate(
    "New Doubt Submitted — Team Pulse",
    `
    <p class="title">❓ New Doubt Submitted</p>

    <p class="body-text">
      Hi <strong>${admin.name}</strong>,
    </p>

    <p class="body-text">
      <strong>${submittedBy}</strong>
      submitted a doubt:
      "${doubt.question}"
    </p>
    `
  );

  return sendEmail({
    to: admin.email,
    subject: `❓ New Doubt from ${submittedBy} — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Doubt Resolved
// ─────────────────────────────────────────────

async function sendDoubtResolvedEmail(
  user,
  doubt,
  answer
) {

  const html = baseTemplate(
    "Doubt Resolved — Team Pulse",
    `
    <p class="title">✅ Your Doubt Has Been Resolved</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
    </p>

    <div class="info-card">

      <div class="info-row"
           style="flex-direction:column;gap:4px;">

        <span class="info-label">Question</span>

        <span class="info-value">
          ${doubt.question}
        </span>

      </div>

      <div class="info-row"
           style="flex-direction:column;gap:4px;margin-top:10px;">

        <span class="info-label">Answer</span>

        <span class="info-value"
              style="color:#16A34A;">
          ${answer}
        </span>

      </div>

    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `✅ Doubt Resolved — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Suggestion
// ─────────────────────────────────────────────

async function sendSuggestionEmail(
  superAdmin,
  suggestion,
  submittedBy
) {

  const html = baseTemplate(
    "New Suggestion — Team Pulse",
    `
    <p class="title">💡 New Suggestion Submitted</p>

    <p class="body-text">
      Hi <strong>${superAdmin.name}</strong>,
    </p>

    <p class="body-text">
      <strong>${submittedBy}</strong>
      proposed:
      "${suggestion.title || suggestion.suggestion}"
    </p>
    `
  );

  return sendEmail({
    to: superAdmin.email,
    subject: `💡 New Suggestion: "${suggestion.title || "Idea"}" — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Welcome Email
// ─────────────────────────────────────────────

async function sendWelcomeEmail(
  user,
  plainPassword
) {

  const html = baseTemplate(
    "Welcome to Team Pulse",
    `
    <p class="title">🎉 Welcome to Team Pulse!</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
    </p>

    <p class="body-text">
      Your account is ready.
      Login credentials:
    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${user.email}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Password</span>
        <span class="info-value"
              style="font-family:monospace;">
          ${plainPassword}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Role</span>
        <span class="info-value">${user.role}</span>
      </div>

    </div>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `🎉 Welcome to Team Pulse — Your Account is Ready`,
    html,
  });
}


// ─────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────

async function sendPasswordResetEmail(
  user,
  newPassword
) {

  const html = baseTemplate(
    "Password Reset — Team Pulse",
    `
    <p class="title">🔐 Password Reset</p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
      your password has been reset to:
      <code>${newPassword}</code>
    </p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `🔐 Password Reset — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Account Status
// ─────────────────────────────────────────────

async function sendAccountStatusEmail(
  user,
  status
) {

  const html = baseTemplate(
    `Account ${status} — Team Pulse`,
    `
    <p class="title">
      Account Status: ${status}
    </p>

    <p class="body-text">
      Hi <strong>${user.name}</strong>,
      your account status is now
      <strong>${status}</strong>.
    </p>
    `
  );

  return sendEmail({
    to: user.email,
    subject: `Account Status: ${status} — Team Pulse`,
    html,
  });
}


// ─────────────────────────────────────────────
// Daily Report
// ─────────────────────────────────────────────

async function sendDailyReportEmail(
  superAdmin,
  stats,
  attachment
) {

  const today = new Date().toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const html = baseTemplate(
    "Daily Report — Team Pulse",
    `
    <p class="title">
      📊 Daily Executive Report — ${today}
    </p>

    <p class="body-text">
      Hi <strong>${superAdmin.name}</strong>,
      here is your automated Team Pulse
      performance summary:
    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Total Tasks</span>
        <span class="info-value">
          ${stats.total_tasks || 0}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Completed Today</span>
        <span class="info-value">
          ${stats.completed_today || 0}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Pending Tasks</span>
        <span class="info-value">
          ${stats.pending || 0}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Overdue Tasks</span>
        <span class="info-value">
          ${stats.overdue || 0}
        </span>
      </div>

    </div>

    ${
      attachment
        ? `
        <p class="body-text"
           style="font-size:13px;color:#2563eb;">

          📎 Formatted Excel report
          (<code>${attachment.filename}</code>)
          is attached to this email.

        </p>
        `
        : ""
    }
    `
  );

  return sendEmail({
    to: superAdmin.email,
    subject: `📊 Team Pulse Daily Executive Report — ${today}`,
    html,
    attachments: attachment
      ? [attachment]
      : undefined,
  });
}


// ─────────────────────────────────────────────
// Test Email
// ─────────────────────────────────────────────

async function sendTestEmail(targetEmail) {

  const time = new Date().toLocaleTimeString(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
    }
  );

  const html = baseTemplate(
    "Email Delivery Test — Team Pulse",
    `
    <p class="title">
      ⚡ Team Pulse Live Email Test
    </p>

    <p class="body-text">
      Hi <strong>Administrator</strong>,
    </p>

    <p class="body-text">

      This test message confirms that your
      <strong>Resend email delivery service</strong>
      is connected and operational.

    </p>

    <div class="info-card">

      <div class="info-row">
        <span class="info-label">Sender</span>
        <span class="info-value">
          ${fromAddress}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Recipient</span>
        <span class="info-value">
          ${targetEmail}
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Service</span>
        <span class="info-value">
          Resend API
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Dispatch Time</span>
        <span class="info-value">
          ${time} (IST)
        </span>
      </div>

      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value"
              style="color:#10b981;">
          ● Active
        </span>
      </div>

    </div>
    `
  );

  return sendEmail({
    to: targetEmail,
    subject: `⚡ Team Pulse Live Email Test — ${time} IST`,
    html,
  });
}


// ─────────────────────────────────────────────
// Email Configuration
// ─────────────────────────────────────────────

function getEmailConfig() {

  return {
    provider: "Resend",
    from: fromAddress,
    configured: Boolean(RESEND_API_KEY),
  };
}


// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {

  sendTaskAssignedEmail,

  sendTaskCreatedToSuperAdmin,

  sendTaskReminderEmail,

  sendTaskOverdueEmail,

  sendDoubtNotificationEmail,

  sendDoubtResolvedEmail,

  sendSuggestionEmail,

  sendWelcomeEmail,

  sendPasswordResetEmail,

  sendAccountStatusEmail,

  sendDailyReportEmail,

  sendTestEmail,

  getEmailConfig,

};