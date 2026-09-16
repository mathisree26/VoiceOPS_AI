# VoiceOPS_AI
Voice-Driven AI Incident Commander for AWS Operations
__________________________________________________________________________________________________________________________________

A RAG Application.

- VOICE INPUT: User prompts UI → Transcribe Streaming outputs text live.
- API TRIGGER: Frontend submits transcript to API Gateway POST /command.
- AGENT ORCHESTRATION: Lambda invokes Bedrock AgentCore Runtime.
- TELEMETRY PROBE: Agent core executes tools to poll CloudWatch metrics and log groups.
- CONTEXT HARVEST: Agent searches Bedrock Knowledge Base for architectural runbooks.
- GEN-AI REASONING: Amazon Nova Foundation Model evaluates evidence vs. system context.
- AUDIO PIPELINE: Lambda routes textual diagnosis to Amazon Polly for MP3 synthesis.
- EXPERIENCE DELIVERY: UI displays explicit markdown analysis and reads audio aloud.

__________________________________________________________________________________________________________________________________

Summer Hackathon Top 3 Winner!!
---

AWS Rockstars Team:
- Mathi Munikrishnan  [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/mathimunikrishnan)
- Aishwarya Murali     [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/aishmurali)
- Kavitha Vanguru       [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/kavithavanguru)
- Prathyusha Reddy     [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/pratyusha-a-372bb9198)
- Surendra Koripella   [![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://www.linkedin.com/in/surendra-koripella)

__________________________________________________________________________________________________________________________________

📋 Table of Contents
---

-	[Overview](#overview)
-	[System Architecture](#system-architecture)
-	[Tech Stack](#tech-stack)
-	[VoiceOPS AI Frontend](#voiceops-ai-frontend)
-	[License](#license)

## Overview
---
>⚠️ Problem Statement: The Core Problem in SRE / Operations

Traditional incident management often breaks down under pressure, leading to drastically inflated Mean Time To Recovery (MTTR) while engineers dig through fragmented telemetry just to answer basic operational questions.

The primary challenges in these high-stress environments include:

Information Silos: Metrics live in systems like CloudWatch, but the corresponding recovery rules sit in static runbooks and aging wiki pages.

Cognitive Overload: In high-severity incidents, engineers lose critical minutes manually correlating dashboard charts.

Friction in Execution: Navigating consoles, querying logs, and typing commands adds interface delay to every single step of the investigation.

>💡 The Solution: VoiceOps AI

VoiceOps AI eliminates operational friction by allowing engineers to ask what is wrong in plain speech and get a reasoned answer read back aloud.

The system follows a streamlined pipeline: Spoken question → transcript → live metrics and logs → runbook context → LLM diagnosis → spoken answer.

It achieves this through four automated steps:

Ask by Voice: Engineers simply ask what is wrong with an app or API, and the web app transcribes the spoken request into live text, hands-free.

Pull Live Telemetry: The request triggers CloudWatch and metrics APIs for latency, error rate, and TPS, plus a scan of recent logs for hidden exceptions.

Consult the Runbooks: A knowledge base of operational runbooks, architecture docs, and past incidents supplies the context behind the raw signals.

Reason and Reply Aloud: An LLM agent correlates metrics with runbook context, infers the likely root cause, and speaks the diagnosis back in a natural voice.


> 🚀 Use Case: Live Incident Demo Story

A classic use case for VoiceOps AI is rapidly correlating symptoms to isolate a 'checkout-api' failure pattern.

1. The Live Symptoms

The engineer starts with a voice prompt: "Check current health of checkout-api and find the cause." or "What is the issue with order worker?".

The system fetches CloudWatch telemetry signals, identifying that latency spiked to ~1900 ms, the error rate surged to 19%, TPS plummeted dramatically, but CPU and memory stayed healthy.

2. Deep-Log Inspection

A Lambda function triggers log mining tools on the active log group.

The inspection surfaces repeated critical errors: HTTP 503 Gateway Errors, DB_CONNECTION_TIMEOUT, active_connections = 50, and max_pool_size = 50.

3. Contextual Diagnosis

Lambda queries the Bedrock Knowledge Base to analyze the findings.

The system matches the patterns against the high-latency runbook and past incident data.

It infers the root cause is database connection pool exhaustion.

Polly then states the recommended next steps—roll back the deployment or upscale the pool.







## System Architecture

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/3774595a-8724-47f6-b7ef-bc427b7eb1c0" />

<img width="1600" height="900" alt="image" src="https://github.com/user-attachments/assets/4ba124f9-39e1-44d2-80b4-42a695d94891" />


## Tech Stack

| Category | Technology | Purpose |
| --- | --- | --- |
| **Frontend & Hosting** | **Amazon S3** | Hosts the static website files (HTML/CSS/JS) for the web application. |
| **Networking & Content Delivery** | **Amazon CloudFront** | Serves as the Content Delivery Network (CDN) to globally distribute the S3 static site with low latency. |
|  | **Amazon Route 53** | Manages DNS routing to direct user traffic to CloudFront. |
| **Security & Identity** | **Amazon Cognito** | Handles user authentication and access control for the application. |
|  | **AWS ACM** | AWS Certificate Manager provisions and manages SSL/TLS certificates for secure communication. |
|  | **AWS STS** | Security Token Service provides temporary, limited-privilege credentials for secure service-to-service interactions. |
| **API & Compute** | **Amazon API Gateway** | Acts as the entry point, routing requests from the frontend to the backend Lambda functions. |
|  | **AWS Lambda** | Serverless compute that orchestrates the core business logic, connecting APIs to Bedrock, telemetry, and speech services. |
| **Artificial Intelligence** | **Amazon Bedrock** | Provides the underlying LLM/AI models to reason over logs, runbooks, and telemetry for incident diagnosis. |
|  | **AWS Transcribe** | Converts spoken questions from engineers into text for the system to process. |
|  | **Amazon Polly** | Converts the text-based diagnostic answers back into lifelike speech. |
| **Observability** | **Amazon CloudWatch** | Provides live telemetry, metrics, and logs for the AI to analyze during an incident. |
| **Knowledge Base Storage** | **Amazon S3 (Knowledge Base)** | Stores internal incident runbooks and architecture documents to provide context for the AI agent. |

## VoiceOPS AI Frontend

<img width="521" height="574" alt="VoiceOPS AI webpage Screenshot" src="https://github.com/user-attachments/assets/57b13497-26fb-4124-b63e-740e5d7f74ba" />


## License

This project is licensed under the MIT License. See LICENSE file for details.

