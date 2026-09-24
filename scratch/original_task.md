# TEAM PULSE — Complete Frontend UI Development Prompt

## Project Overview

Build a complete, modern, professional frontend UI for my existing **TEAM PULSE** application.

**Application:** Team Pulse
**Technology:** Flask + SQLite + Jinja2
**Backend:** Already implemented in `team_pulse.py`
**Frontend:** HTML5 + CSS3 + Vanilla JavaScript + Jinja2
**Do NOT change the backend logic unless absolutely necessary.**

The application is a **Team Task Management & Performance Monitoring System** with role-based access.

---

# 1. IMPORTANT DEVELOPMENT RULES

* Use the existing Flask routes and Jinja variables from `team_pulse.py`.
* Do not rename existing Flask routes.
* Do not rename existing database fields.
* Do not remove existing functionality.
* Do not replace Flask/Jinja with React.
* Do not use external frameworks unless required.
* Use clean HTML5, CSS3 and vanilla JavaScript.
* Every page must be responsive for:

  * Desktop
  * Laptop
  * Tablet
  * Mobile
* Create reusable UI components where possible.
* Maintain one consistent design system across every page.
* Avoid inline CSS wherever possible.
* Prefer a shared stylesheet such as:
  `static/css/style.css`
* Use Jinja2 syntax correctly.
* All forms must submit to the existing Flask routes.
* All navigation links must use `url_for()`.
* Never hardcode dashboard URLs when `url_for()` can be used.

---

# 2. DESIGN SYSTEM

Create a modern SaaS/admin-dashboard style interface.

## Primary Colors

Use this color palette:

* Primary: `#2563EB`
* Primary Dark: `#1D4ED8`
* Secondary: `#7C3AED`
* Background: `#F8FAFC`
* Card Background: `#FFFFFF`
* Sidebar: `#0F172A`
* Sidebar Hover: `#1E293B`
* Text Primary: `#0F172A`
* Text Secondary: `#64748B`
* Border: `#E2E8F0`

## Status Colors

Success:
`#16A34A`

Warning:
`#F59E0B`

Danger:
`#DC2626`

Info:
`#0EA5E9`

Completed:
Green

Pending:
Orange

In Progress:
Blue

Open:
Orange

Answered:
Green

New:
Blue

Reviewed:
Green

## Visual Style

Use:

* Rounded cards
* Soft shadows
* Clean spacing
* Modern typography
* Professional dashboard layout
* Subtle hover animations
* Smooth transitions
* Clear buttons
* Clean tables
* Status badges
* Statistics cards
* Responsive navigation

Avoid:

* Excessive gradients
* Very bright backgrounds
* Cluttered UI
* Huge unnecessary animations
* Poor mobile layouts

---

# 3. COMMON LAYOUT

Create a reusable layout for all authenticated pages.

Desktop:

Sidebar on the left.

Main content on the right.

Sidebar should contain:

TEAM PULSE logo/name

Navigation:

* Dashboard
* Users
* Teams
* Tasks
* Doubts
* Suggestions
* Leaderboard
* Activities
* Reports
* Profile
* Logout

Role-based navigation:

## SUPER_ADMIN

Show:

* Dashboard
* Users
* Teams
* Tasks
* Doubts
* Suggestions
* Leaderboard
* Activities
* Reports
* Profile
* Logout

## ADMIN

Show:

* Dashboard
* Users
* Tasks
* Doubts
* Suggestions
* Leaderboard
* Profile
* Logout

## TEAM_MEMBER

Show:

* Dashboard
* Tasks
* Doubts
* Suggestions
* Leaderboard
* Profile
* Logout

Do not show unauthorized menu items.

---

# 4. TOP NAVBAR

Create a professional top navbar.

Include:

* Page title
* Logged-in user name
* User role
* Profile icon/avatar
* Notification icon if appropriate
* Logout button

Mobile:

Convert sidebar into a hamburger menu.

---

# 5. LOGIN PAGE

File:

`templates/login.html`

Create a modern professional login page.

Features:

* TEAM PULSE logo
* Welcome message
* Email field
* Password field
* Show/hide password
* Login button
* Error message
* Success message
* Loading state
* Responsive design

Use:

```jinja2
{{ get_flashed_messages() }}
```

or the existing Flask flash message system.

Login should submit to:

```text
/login
```

Do not modify authentication logic.

---

# 6. SUPER ADMIN DASHBOARD

File:

`templates/dashboard_super.html`

Create a premium admin dashboard.

Display statistics from:

```python
stats
```

Use:

* Total Teams
* Total Admins
* Total Members
* Total Tasks
* Pending Tasks
* Completed Tasks
* Total Doubts
* Open Doubts
* Total Suggestions

Create statistic cards.

## Team Performance

Use:

```python
team_perf
```

Display a professional table:

| Team | Total Tasks | Completed | Progress |

Create a visual progress bar.

Calculate/display:

```text
pct
```

Add:

* Team performance overview
* Quick actions
* Recent activity section if available
* Task completion overview

Quick action buttons:

* Add Team
* Add User
* Add Task
* View Reports

---

# 7. ADMIN DASHBOARD

File:

`templates/dashboard_admin.html`

Use existing:

```python
team
stats
```

Display:

* Team name
* Team description
* Members
* Total Tasks
* Completed
* Pending
* Team Points

Create:

## Team Overview

Show team information.

## Performance Cards

Use attractive statistic cards.

## Quick Actions

* Add User
* Add Task
* View Users
* View Tasks
* View Doubts
* View Suggestions

Only allow actions available to ADMIN.

---

# 8. TEAM MEMBER DASHBOARD

File:

`templates/dashboard_member.html`

Use:

```python
team
stats
my_points
recent
```

Display:

* Team name
* Welcome message
* My Points
* Pending Tasks
* In Progress Tasks
* Completed Tasks
* Overdue Tasks

Create:

## My Performance

Show:

* Points
* Completed tasks
* Pending tasks
* In-progress tasks

## Recent Activity

Use:

```python
recent
```

Display activity timeline.

Quick actions:

* My Tasks
* Ask Doubt
* Submit Suggestion
* Leaderboard
* Profile

---

# 9. USERS PAGE

File:

`templates/users.html`

Create a professional user management page.

Features:

* User table
* Search
* Team filter
* Role filter
* Status badge
* User name
* Email
* Role
* Team
* Points
* Status
* Created date

Actions:

* Add User
* Edit
* Delete

Delete should use the existing POST route.

Use confirmation dialog before delete.

Role badges:

SUPER_ADMIN
ADMIN
TEAM_MEMBER

Make table responsive.

On mobile, convert rows into cards if necessary.

---

# 10. USER FORM

File:

`templates/user_form.html`

Create Add/Edit User form.

Fields:

* Name
* Email
* Password
* Role
* Team
* Status

For edit:

* Show existing values
* Password optional

Buttons:

* Save
* Update
* Cancel

Show validation errors using Flask flash messages.

---

# 11. TEAMS PAGE

File:

`templates/teams.html`

Create Super Admin team management dashboard.

Display:

* Team ID
* Team name
* Admin
* Members
* Total Tasks
* Completed Tasks

Actions:

* Add Team
* Edit Team
* Delete Team

Use:

```python
teams
```

for Jinja rendering.

Add confirmation before deleting.

---

# 12. TEAM FORM

File:

`templates/team_form.html`

Fields:

* Team Name
* Description

Buttons:

* Create Team
* Update Team
* Cancel

Clean professional form design.

---

# 13. TASKS PAGE

File:

`templates/tasks.html`

Create complete task management interface.

Filters:

* Search
* Team
* Member
* Status
* Priority

Task table:

* Title
* Team
* Assigned To
* Priority
* Status
* Due Date
* Created Date
* Actions

Status badges:

Pending → Orange

In Progress → Blue

Completed → Green

Priority:

Low → Gray/Blue

Medium → Orange

High → Red

Actions:

* Edit
* Delete
* Update Status

Team members should only see tasks assigned to them according to backend permissions.

---

# 14. TASK FORM

File:

`templates/task_form.html`

Create task creation/edit form.

Fields:

* Title
* Description
* Team
* Assigned Member
* Priority
* Due Date
* Status when editing

Features:

* Dynamic member loading based on team
* Clean date picker
* Form validation
* Save button
* Cancel button

Use the existing endpoint:

```text
/tasks/members/<team_id>
```

for member loading.

Do not change backend API behavior.

---

# 15. DOUBTS PAGE

File:

`templates/doubts.html`

Create a professional doubt management page.

Team members:

* Submit doubt
* View their doubts
* See answer
* See status

Admin/Super Admin:

* View doubts
* Filter by status
* Search doubts
* Answer doubts

Status:

Open
Answered

Create:

* Question card/table
* Asked by
* Team
* Date
* Status
* Answer

Answer form should submit to the existing route.

---

# 16. SUGGESTIONS PAGE

File:

`templates/suggestions.html`

Features:

Team members:

* Submit suggestion
* View suggestions
* See response
* See status

Admin/Super Admin:

* Review suggestions
* Add response
* Change status

Display:

* Suggestion
* Author
* Team
* Status
* Response
* Date

Statuses:

New
Reviewed
Accepted
Rejected

Use existing Flask routes.

---

# 17. LEADERBOARD

File:

`templates/leaderboard.html`

Create attractive ranking page.

Display:

* Rank
* Member
* Team
* Points

Top 3 should have special ranking cards.

Example:

🥇 Rank 1

🥈 Rank 2

🥉 Rank 3

Remaining members in a clean table.

Add:

* Current user's highlight
* Points explanation

---

# 18. ACTIVITIES PAGE

File:

`templates/activities.html`

Super Admin only.

Create activity timeline/table.

Display:

* User
* Activity
* Date/time

Use:

```python
rows
```

Features:

* Search/filter if possible
* Timeline style
* Recent activity indicator

---

# 19. PROFILE PAGE

File:

`templates/profile.html`

Create user profile page.

Display:

* Name
* Email
* Role
* Team
* Status

Password change section:

* Current Password
* New Password
* Confirm Password

Use existing Flask password update functionality.

Add password visibility toggle.

Show validation messages.

---

# 20. REPORTS PAGE

File:

`templates/reports.html`

Create professional analytics/report dashboard.

Display:

## Team Performance

Use:

```python
team_perf
```

Show:

* Team
* Total Tasks
* Completed
* Completion %

## Member Performance

Use:

```python
member_perf
```

Show:

* Member
* Team
* Points
* Completed Tasks

Add visual progress bars.

## Export Buttons

Create:

* Export Tasks CSV
* Export Points CSV
* Export Teams CSV

Use existing routes:

```text
/reports/export/tasks
/reports/export/points
/reports/export/teams
```

Do not change these backend routes.

---

# 21. ERROR PAGE

File:

`templates/error.html`

Create professional error page.

Support:

```jinja2
{{ code }}
{{ message }}
```

Display:

* Error code
* Error message
* Team Pulse branding
* Back to Dashboard button
* Back to Login button if required

Design separate styles for:

404
403
400
500

---

# 22. FLASH MESSAGES

Create reusable flash message component.

Support:

* success
* danger
* warning
* info

Example:

```html
<div class="alert alert-success">
    ...
</div>
```

Add close button.

Auto-hide after a few seconds.

---

# 23. RESPONSIVE DESIGN

Must work correctly at:

```text
1920px
1440px
1200px
992px
768px
576px
375px
```

Mobile:

* Sidebar becomes hamburger menu
* Tables become horizontally scrollable or cards
* Buttons become touch-friendly
* Cards stack vertically
* Forms become single-column
* No horizontal page overflow

---

# 24. JAVASCRIPT FEATURES

Use vanilla JavaScript.

Implement:

* Mobile sidebar toggle
* Password show/hide
* Delete confirmation
* Flash message auto-close
* Task member dynamic loading
* Search/filter interaction where useful
* Form loading state
* Smooth UI transitions

Do not introduce unnecessary dependencies.

---

# 25. ACCESSIBILITY

Use:

* Proper labels
* Semantic HTML
* Keyboard-friendly buttons
* Visible focus states
* Good contrast
* ARIA labels where necessary
* Accessible forms

---

# 26. FILE STRUCTURE

Create/organize the project as:

```text
team_pulse/
│
├── team_pulse.py
├── team_pulse.db
├── requirements.txt
├── Procfile
│
├── templates/
│   ├── login.html
│   ├── error.html
│   ├── dashboard_super.html
│   ├── dashboard_admin.html
│   ├── dashboard_member.html
│   ├── users.html
│   ├── user_form.html
│   ├── teams.html
│   ├── team_form.html
│   ├── tasks.html
│   ├── task_form.html
│   ├── doubts.html
│   ├── suggestions.html
│   ├── leaderboard.html
│   ├── activities.html
│   ├── profile.html
│   └── reports.html
│
└── static/
    ├── css/
    │   └── style.css
    │
    └── js/
        └── app.js
```

---

# 27. IMPORTANT JINJA VARIABLES

Use the variables already supplied by the Flask backend.

Common:

```jinja2
{{ current_user }}
```

Super Admin:

```jinja2
{{ stats }}
{{ team_perf }}
```

Admin:

```jinja2
{{ team }}
{{ stats }}
```

Member:

```jinja2
{{ team }}
{{ stats }}
{{ my_points }}
{{ recent }}
```

Users:

```jinja2
{{ users }}
{{ teams }}
{{ q }}
{{ team_filter }}
{{ role_filter }}
```

Tasks:

```jinja2
{{ tasks }}
{{ teams }}
{{ q }}
{{ team_filter }}
{{ member_filter }}
{{ status_filter }}
{{ priority_filter }}
```

Doubts:

```jinja2
{{ doubts }}
{{ status_filter }}
{{ q }}
```

Suggestions:

```jinja2
{{ suggestions }}
{{ status_filter }}
{{ q }}
```

Leaderboard:

```jinja2
{{ rows }}
```

Activities:

```jinja2
{{ rows }}
```

Reports:

```jinja2
{{ team_perf }}
{{ member_perf }}
```

Profile:

```jinja2
{{ user }}
{{ team }}
```

---

# 28. FLASK ROUTES TO RESPECT

Existing routes include:

```text
/
/login
/logout
/dashboard

/users
/users/add
/users/edit/<user_id>
/users/delete/<user_id>

/teams
/teams/add
/teams/edit/<team_id>
/teams/delete/<team_id>

/tasks
/tasks/add
/tasks/members/<team_id>
/tasks/edit/<task_id>
/tasks/status/<task_id>
/tasks/delete/<task_id>

/doubts
/doubts/answer/<doubt_id>

/suggestions
/suggestions/review/<sug_id>

/leaderboard
/activities
/profile
/reports

/reports/export/tasks
/reports/export/points
/reports/export/teams

/health
```

Do not break these routes.

---

# 29. FINAL QUALITY REQUIREMENTS

After generating the frontend:

1. Verify every template exists.
2. Verify every Jinja variable is valid.
3. Verify every `url_for()` endpoint exists.
4. Verify forms use correct methods.
5. Verify POST forms use the correct Flask routes.
6. Verify role-based navigation.
7. Verify responsive design.
8. Verify no `TemplateNotFound` errors.
9. Verify no undefined Jinja variables.
10. Verify all pages visually follow the same Team Pulse design system.
11. Do not modify `team_pulse.py` unnecessarily.
12. Do not delete existing working functionality.

## Final Goal

The final application should look like a **professional production-ready SaaS Team Management Dashboard**, not a basic HTML project.

It should feel similar to a modern:

* Admin dashboard
* Project management system
* Team performance platform
* Task management application

Use the TEAM PULSE brand consistently throughout the application.

Most importantly:

**Keep the existing Flask backend working exactly as it is and build the complete frontend around it.**
