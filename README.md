# AI Email Assistant
#### Made by Pranav Bhatia

This project is an AI-powered email assistant that connects directly to your Gmail account. It allows users to read emails, delete emails, and generate replies using simple natural language prompts.

## How It Works
When the user enters a prompt, it is processed by an interpreter. The interpreter sends the information to an LLM, which decides what action should be taken. Based on the model’s response, the system either fetches emails, deletes an email, or creates a reply.

## Features

###  1. Fetch Latest Emails
- Automatically shows the latest 5 emails from your Gmail inbox  
- Each email includes an AI-generated suggested reply  
- Replies can be sent instantly with one click  

###  2. Delete Emails
- The assistant can delete specific emails based on user prompts  
- The LLM extracts the details (which email, sender, or subject)  

###  3. AI-Generated Replies
- Every email comes with a ready-to-send suggested reply  
- The suggestions are based on the email content and user intent  

###  4. Refine With AI
- A **"Refine with AI"** button opens a modal  
- Users can edit or adjust their prompt  
- The AI improves or rewrites the reply before sending  
- Useful for tone changes, corrections, or adding details  

## Tech Stack

### Frontend
- **Next.js** – Used for building the UI and routing. The app uses Next.js pages/components to render the login screen, dashboard, and chat interface.
- **React** – Handles the interactive parts of the UI, such as the chat input, email list, buttons, and the “Refine with AI” modal.
- **Tailwind CSS** (if used) – For styling the app with utility classes and keeping the UI clean and responsive.

### Backend / Logic
- **Google OAuth** – Used for secure login with a Google account. After login, the user is authenticated and the app can safely access their Gmail data with permission.
- **Google Gmail API** – Handles all email operations:
  - Fetching the latest 5 emails  
  - Deleting specific emails  
  - Accessing email content so the AI can read and generate replies
- **Google Gemini API** – Acts as the LLM. It:
  - Interprets the user’s prompt (what they want to do: read, delete, reply, etc.)
  - Generates suggested replies for each email
  - Refines replies when the user uses the “Refine with AI” option

### Deployment
- **Vercel** – Used to deploy the Next.js app. It hosts both the frontend and backend (API routes), making the app accessible online with environment variables configured for all the APIs.

## Setup Instructions

### 1. Clone the Repository
```
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 2. Install Dependencies
```
npm install
```
### 3. Create a Google Cloud Project

-  Go to Google Cloud Console
- Create a new project
- Enable Gmail API
- Enable Google OAuth
- Create OAuth credentials (Web Application)
- Add your redirect URI, for example:
http://localhost:3000/api/auth/callback/google

### 4. Add Environment Variables

#### Create a .env.local file and add:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GEMINI_API_KEY=
NEXTAUTH_URL=Your URL
NEXTAUTH_SECRET=
```
### 5. Run the Project Locally
```
npm run dev
```
