# AI Email Assistant

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
