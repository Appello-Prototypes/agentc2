# MKWA - Customer Deep Research Report

**Date:** February 11, 2026
**Prepared by:** AI Research Agent
**Risk Level:** CHURN RISK - Identified by Ian Haase
**Account Owner:** Ian Haase (Co-Founder, Appello)
**Key Contact at MKWA:** Valerie Weller

---

## Executive Summary

MKWA is an active Appello customer with a history of both **bug reports** and **feature requests** spanning from June 2025 to October 2025. They were onboarded around June 2025 (data import ticket created June 4, 2025) and have since raised **7 tracked Jira tickets** and at least **4 linked HubSpot support tickets**. Ian Haase has flagged this account as a **churn risk**, indicating that MKWA's experience with the platform has not been meeting their expectations.

The issues cluster around three core areas:

1. **Timesheet & Payroll** -- vacation hours, rate types, CSV exports, stat holidays
2. **Job Management** -- custom filters, mobile app bugs
3. **Scheduling & Calendar** -- stat holiday automation

While **5 of the 7 Jira tickets have been resolved** ("In Prod"), **1 critical feature request remains unaddressed** (stat holiday integration) and the overall volume of issues in a short time window suggests systemic friction with the product.

---

## Data Sources Searched

| Source                 | Results                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Jira**               | 7 tickets found (text search for "MKWA")                                                                   |
| **HubSpot (Tickets)**  | 4 linked tickets referenced in Jira descriptions                                                           |
| **HubSpot (Company)**  | Company not found as a standalone HubSpot record -- may be stored under a parent company or alternate name |
| **HubSpot (Contacts)** | Valerie Weller not found in top search results -- may need manual verification                             |
| **HubSpot (Deals)**    | No deal named "MKWA" found in deal pipeline                                                                |
| **Fathom**             | No MKWA-specific meetings found in recent recordings (API does not support keyword search of transcripts)  |
| **Slack**              | Search tool unavailable (no `search_messages` endpoint in current Slack MCP server)                        |
| **ATLAS/n8n**          | Not applicable -- no MKWA-specific workflows                                                               |

---

## All MKWA Jira Tickets (Complete Inventory)

### OPEN / OUTSTANDING

#### 1. Q21030-10395 -- Stat Holiday Integration into Calendar

| Field        | Detail                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Summary**  | MKWA: To incorporate public/stat holiday into the calendar - more accurate scheduling & vacation calculations |
| **Status**   | **TO REFINE** (Not Started)                                                                                   |
| **Priority** | Medium                                                                                                        |
| **Assignee** | Unassigned                                                                                                    |
| **Reporter** | Kylin Cheong                                                                                                  |
| **Created**  | October 6, 2025                                                                                               |
| **Updated**  | October 6, 2025                                                                                               |
| **Type**     | Feature Request                                                                                               |

**Description:**
Currently, the system doesn't have any way to keep track of public holidays. Users have to rely on their own calendars for scheduling and vacation planning. MKWA is asking if there is a way to automate paid stat holidays into timesheets.

**Proposed Solution:**

- Allow users to select & incorporate public/stat holidays that are applicable
- Support filtering by Country, by States or Provinces
- Allow users to select if holidays are paid or unpaid
- Based on configuration, display holidays appropriately and calculate time correctly across:
    - Scheduling
    - Timesheets
    - Vacation/Leave

**RISK FACTOR:** This is the **only unresolved ticket** and represents a significant **feature gap** that directly impacts MKWA's day-to-day operations. It has been sitting unassigned since October 2025 -- **over 4 months with no progress**.

---

### RESOLVED (In Production)

#### 2. Q21030-10424 -- Paid Vacation Showing 0 Hours in Timesheet

| Field              | Detail                                                              |
| ------------------ | ------------------------------------------------------------------- |
| **Summary**        | MKWA: Wayne Twance's paid vacation is showing up as 0 in timesheet  |
| **Status**         | In Prod (Resolved)                                                  |
| **Priority**       | Medium                                                              |
| **Assignee**       | Emma Mann                                                           |
| **Reporter**       | Kylin Cheong                                                        |
| **Created**        | October 9, 2025                                                     |
| **HubSpot Ticket** | #31381478784                                                        |
| **Loom Video**     | [View](https://www.loom.com/share/aac002fcfc5f4fb5a1dc81dce00750fc) |

**Description:** Paid vacation for employee Wayne Twance was displaying as 0 hours in the timesheet. Should have had hours attached to the vacation entry.

---

#### 3. Q21030-10422 -- Total Hour Column in Employee Timesheet Report CSV

| Field              | Detail                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Summary**        | Mkwa: Adding Total Hour column after Wage Rate (1X, 1.5X, 2X) in Employee Timesheet Report CSV               |
| **Status**         | In Prod (Resolved)                                                                                           |
| **Priority**       | Medium                                                                                                       |
| **Assignee**       | Filip                                                                                                        |
| **Reporter**       | Corey Shelson                                                                                                |
| **Created**        | October 9, 2025                                                                                              |
| **Requested By**   | Valerie Weller (MKWA)                                                                                        |
| **HubSpot Ticket** | #31459724152                                                                                                 |
| **Loom Video**     | [View](https://www.loom.com/share/f2678893a5e74c03a047da1b5d6d9729?sid=be9a5cec-02f6-43ca-b744-471c138edfe4) |

**Description:** Feature request to add a total column in the Employee Timesheet Report that shows the sum of 1X + 1.5X hours. Described as "not high priority, but might be a quick one."

---

#### 4. Q21030-10254 -- Mobile App: Unable to Add 2nd Job in Timesheet

| Field          | Detail                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| **Summary**    | MKWA: Mobile App: Unable to add 2nd job in timesheet - unscheduled jobs      |
| **Status**     | In Prod (Resolved)                                                           |
| **Priority**   | **High**                                                                     |
| **Assignee**   | John Breland                                                                 |
| **Reporter**   | Kylin Cheong                                                                 |
| **Created**    | September 12, 2025                                                           |
| **Loom Video** | [View](https://loom.com/share/252ef85fd0ad418cb66a4a0022c97f7f?src=composer) |

**Description:** Users were unable to add timesheets for unscheduled jobs when selecting a specific job that is a subcustomer. This occurred for super admin users and prevented them from logging hours for certain jobs, impacting their ability to track work accurately.

**Steps to Reproduce:**

1. Log in as a super admin user
2. Navigate to the job list
3. Access the timesheet section
4. Attempt to add a time entry for an unscheduled job
5. Select a job that is a subcustomer
6. Observe the error when trying to save

---

#### 5. Q21030-9954 -- Employee Timesheet Report CSV Not Summarizing

| Field              | Detail                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Summary**        | MKWA: Employee Timesheet Report                                                                              |
| **Status**         | In Prod (Resolved)                                                                                           |
| **Priority**       | Medium                                                                                                       |
| **Assignee**       | Emma Mann                                                                                                    |
| **Reporter**       | Corey Shelson                                                                                                |
| **Created**        | July 24, 2025                                                                                                |
| **Reported By**    | Ian Haase                                                                                                    |
| **HubSpot Ticket** | #26971118479                                                                                                 |
| **Loom Video**     | [View](https://www.loom.com/share/e70abba3604740788b4b85ff94b9cdc0?sid=4739adf1-b1d3-48d7-80b0-6d6061072263) |

**Description:** Employee Timesheet Report was not summarizing hours by rate type in the downloaded CSV. Ian Haase reported this on behalf of MKWA.

---

#### 6. Q21030-9508 -- Custom Filters Not Working on Job Page

| Field              | Detail                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Summary**        | MKWA: Custom filters is not showing the correct result in Job Views                                          |
| **Status**         | In Prod (Resolved)                                                                                           |
| **Priority**       | **High**                                                                                                     |
| **Assignee**       | Emma Mann                                                                                                    |
| **Reporter**       | Corey Shelson                                                                                                |
| **Created**        | June 12, 2025                                                                                                |
| **Reported By**    | Ian Haase                                                                                                    |
| **HubSpot Ticket** | #25316609205                                                                                                 |
| **Loom Video**     | [View](https://www.loom.com/share/a0189dbe35684800b6b374c28c88a2e6?sid=23d6dbd9-c4c9-4406-b258-943fbdd1eab2) |

**Description:** Custom filters on the Job page were not showing correct results. Reported by Ian Haase with video showing the issue.

---

#### 7. Q21030-9440 -- MKWA Data Import

| Field         | Detail                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Summary**   | Mkwa Import                                                                                                          |
| **Status**    | In Prod (Resolved)                                                                                                   |
| **Priority**  | Medium                                                                                                               |
| **Assignee**  | Christopher Vachon                                                                                                   |
| **Reporter**  | Christopher Vachon                                                                                                   |
| **Created**   | June 4, 2025                                                                                                         |
| **Reference** | [Google Sheet](https://docs.google.com/spreadsheets/d/1g2P7hjCZQA4gbwDLDSCaMAIgagD2SqySFx9BBAQR44M/edit?usp=sharing) |

**Description:** Initial data import for MKWA during onboarding.

---

## Consolidated Action Items - What We Need to Do for MKWA

### CRITICAL (Immediate Action Required)

| #   | Action Item                            | Source          | Status    | Owner      | Notes                                                                                                             |
| --- | -------------------------------------- | --------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Build Stat Holiday Integration**     | Q21030-10395    | UNSTARTED | Unassigned | Sitting unassigned for 4+ months. Must be prioritized. Affects scheduling, timesheets, and vacation calculations. |
| 2   | **Assign dedicated owner to MKWA**     | Churn risk flag | N/A       | Leadership | Ian flagged churn risk -- need a clear retention plan and named owner.                                            |
| 3   | **Schedule a check-in call with MKWA** | Churn risk flag | N/A       | Ian Haase  | Proactive outreach to understand current satisfaction and any additional unreported issues.                       |

### IMPORTANT (Verify & Follow Up)

| #   | Action Item                                         | Source                                 | Status  | Notes                                                                                                                      |
| --- | --------------------------------------------------- | -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| 4   | **Verify all resolved bugs are actually working**   | Q21030-10424, 10422, 10254, 9954, 9508 | In Prod | 5 tickets marked "In Prod" -- confirm with MKWA that these fixes are satisfactory and no regressions.                      |
| 5   | **Confirm Timesheet Report CSV totals are correct** | Q21030-10422, 9954                     | In Prod | Two separate timesheet report issues were filed. Verify the CSV export includes proper totals by rate type (1X, 1.5X, 2X). |
| 6   | **Confirm mobile app timesheet entry works**        | Q21030-10254                           | In Prod | High-priority mobile bug was blocking their field workers from logging time. Verify fix is stable.                         |
| 7   | **Confirm custom filters on Job page work**         | Q21030-9508                            | In Prod | High-priority bug. Verify filters function correctly for MKWA's specific job views.                                        |

### NICE-TO-HAVE (Relationship Building)

| #   | Action Item                                | Source           | Notes                                                                                                  |
| --- | ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------ |
| 8   | **Create MKWA company record in HubSpot**  | Research finding | No HubSpot company record found for "MKWA" -- ensure CRM data is complete.                             |
| 9   | **Document MKWA onboarding status**        | Q21030-9440      | Onboarding import was done June 2025. Ensure all data was imported correctly and they're fully set up. |
| 10  | **Build relationship with Valerie Weller** | Q21030-10422     | She's an active user submitting feature requests. Good candidate for user feedback group.              |

---

## Timeline of MKWA Issues

```
June 4, 2025    -- Q21030-9440: Data Import (Onboarding)
June 12, 2025   -- Q21030-9508: Custom Filters Bug (HIGH) ............ RESOLVED
July 24, 2025   -- Q21030-9954: Timesheet Report CSV Bug ............. RESOLVED
Sept 12, 2025   -- Q21030-10254: Mobile App Timesheet Bug (HIGH) ..... RESOLVED
Oct 6, 2025     -- Q21030-10395: Stat Holiday Feature Request ........ OPEN (4+ months!)
Oct 9, 2025     -- Q21030-10422: Timesheet Total Column Feature ...... RESOLVED
Oct 9, 2025     -- Q21030-10424: Vacation Hours Bug .................. RESOLVED
```

**Pattern:** 7 tickets in ~4 months (June-October 2025), with a cluster of 3 tickets in a single week (Oct 6-9). This velocity of issues suggests frustration building over time.

---

## Key People

| Person             | Role               | Relationship to MKWA                                                                          |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------------- |
| **Ian Haase**      | Appello Co-Founder | Primary account relationship. Reported multiple tickets on MKWA's behalf. Flagged churn risk. |
| **Valerie Weller** | MKWA Contact       | Active user. Submitted feature request for timesheet total column.                            |
| **Wayne Twance**   | MKWA Employee      | Subject of vacation hours bug -- likely a worker/foreman.                                     |
| **Kylin Cheong**   | Appello Support    | Reported 3 of the 7 MKWA tickets. Primary support contact.                                    |
| **Corey Shelson**  | Appello            | Reported 3 of the 7 MKWA tickets.                                                             |
| **Emma Mann**      | Appello Dev        | Resolved 3 of the 5 completed tickets.                                                        |

---

## Risk Assessment

### Why MKWA May Churn

1. **Unresolved Feature Request (4+ months):** The stat holiday integration (Q21030-10395) has been sitting in "To Refine" with no assignee since October 6, 2025. This is a meaningful operational gap for their business.

2. **High Bug Volume Early in Relationship:** 7 tickets in 4 months post-onboarding indicates a rough customer experience. Multiple high-priority bugs affecting core functionality (mobile timesheets, job filters).

3. **Core Workflow Impact:** All issues are centered around timesheets, scheduling, and job management -- these are MKWA's daily bread-and-butter workflows. Problems here directly impact their operations.

4. **Multiple Touchpoints Required:** Issues were reported via Ian, Kylin, and Corey -- suggesting MKWA has had to escalate through multiple channels to get attention.

### Recommended Retention Strategy

1. **Immediately assign and prioritize Q21030-10395** (Stat Holiday Integration)
2. **Schedule executive check-in call** with MKWA within 1 week
3. **Send a summary of all resolved issues** demonstrating responsiveness
4. **Create a roadmap commitment** for the stat holiday feature with a target delivery date
5. **Offer a dedicated support channel** (e.g., Slack Connect or priority email) to reduce friction

---

## Data Gaps & Limitations

- **HubSpot:** The search API returned generic results rather than MKWA-specific records. MKWA may not have a dedicated company record, or it may be stored under a different name. Manual HubSpot verification recommended.
- **Fathom:** The meeting recording API does not support keyword search of transcripts. MKWA-specific meetings may exist but could not be identified programmatically. Manual search of Fathom recommended.
- **Slack:** The Slack MCP server does not include a `search_messages` tool. Channel history was retrieved but would require manual review of all channels to find MKWA mentions. Recommend manual Slack search for "MKWA".
- **No Deal/Revenue Data:** No MKWA deal found in HubSpot pipeline. ARR/MRR impact of potential churn is unknown.

---

_Report generated from Jira, HubSpot, Fathom, and Slack data via Mastra AI Agent platform._
