# SusuBox
SusuBox


Group savings, made transparent.



SusuBox is a mobile application that digitises rotating savings groups (susu) for Ghanaian and African communities. It replaces paper records and WhatsApp coordination with a secure, transparent platform for contribution tracking, payout management, and member accountability.


What is a Susu?

A susu (also called tontine or rotating savings group) is a community savings practice where a group of people contribute a fixed amount of money regularly. Each cycle, one member receives the full pot. The rotation continues until every member has received once.

Example: 8 members each contribute GHS 100 every week. The pot is GHS 800. Each week a different member receives the full GHS 800. After 8 weeks, everyone has received once and the cycle is complete.


The Problem

Traditional susu groups run on trust and paper records:


Contributions are tracked in notebooks that can be lost
Members dispute payment records with no audit trail
Members receive the pot early then stop contributing
No transparency — only the admin sees the full picture
No accountability when someone defaults



The Solution

SusuTrack digitises the entire lifecycle:


Every contribution is recorded automatically via Paystack mobile money
All members see the same real-time payment status
Identity verification (Ghana Card + selfie) prevents anonymous defaulting
Penalty fees accumulate automatically for missed contributions
Payout deductions are calculated and shown transparently before release
Push notifications and emails keep everyone informed



Features

Core Features


Create and manage multiple susu groups
Invite members via shareable code or deep link
Track contributions in real time via Paystack (MTN MoMo, Vodafone Cash, AirtelTigo, bank transfer)
Payout rotation schedule visible to all members
Full contribution history and financial reports


Identity & Accountability


Ghana Card / Voter ID / Passport capture at registration
Selfie capture with face detection
Admin manual review before approving members
ID Verified badge on member profiles


Anti-Default Enforcement


Smart rotation order — trusted members receive first
Payout freeze — blocked automatically if recipient has unpaid contributions
Penalty deduction — missed cycles accumulate debt deducted from payout
Public late status — visible to all group members
Escalating push notifications — day 1, 3 days before, 1 day before, day after deadline
Reliability score — on-time payment percentage per member
Streak badges — Reliable Contributor, Trusted Member, Susu Champion
Admin remove and blocklist — chronic non-payers cannot rejoin


Trust & Transparency


All members see identical real-time payment data
Full audit trail of every transaction
Payout deduction preview — pot − arrears − penalties = net payout
Group rules acknowledgement before joining
Terms and Conditions accepted at signup


Notifications


Push notifications via Firebase Cloud Messaging
Email alerts via Nodemailer (Gmail SMTP)
In-app notification centre with read/unread state


Single Session Authentication


Only one active login per user at a time
Force logout other device option on login
Session conflict detection on every API call



Tech Stack

Mobile App (Frontend)

TechnologyPurposeExpo (React Native)Cross-platform iOS and AndroidTypeScriptType safety throughoutReact Navigation v6Stack + bottom tab navigationReact Native PaperMaterial Design 3 componentsexpo-secure-storeSecure JWT and session storageexpo-image-pickerID card and selfie captureexpo-cameraLive camera with face detectionreact-native-paystack-webviewPaystack payment checkout@react-native-firebase/messagingFCM push notificationsreact-native-shareShare invite linksreact-native-chart-kitReports and analytics chartsaxiosAPI calls to backend

Backend (API)

TechnologyPurposeNode.js + ExpressREST API serverPostgreSQLPrimary databaseSequelizeORM and database queriesJWT + bcryptAuthentication and password securityPaystack APIMobile money payment processingFirebase Admin SDKSend FCM push notificationsNodemailerEmail notifications via Gmail SMTPCloudinarySecure image storage (ID cards, selfies, profile photos)MulterFile upload handlingexpress-rate-limitBrute force protection

Infrastructure

ServicePurposeRenderBackend API hosting (free tier)SupabaseManaged PostgreSQL database (free tier)CloudinaryImage CDN and storage (free tier)FirebasePush notification deliveryGitHubVersion control
