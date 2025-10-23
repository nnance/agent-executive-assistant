import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appleCalendarServer } from "./apple-tools/apple-calendar.js";
import {
	appleContactsServer,
	ContactsManager,
} from "./apple-tools/apple-contacts.js";
import { appleNotesServer } from "./apple-tools/apple-notes.js";

// Parse the first command line argument as the prompt
const prompt = process.argv[2];

if (!prompt) {
	console.error("Error: Please provide a prompt as the first argument");
	console.error('Usage: npm start "Your prompt here"');
	process.exit(1);
}

const SYSTEM_PROMPT = `
You are an executive assistant AI agent with access to Apple Applications (Calendar, Notes) on the user's Mac. 
Use the provided tools to manage and retrieve information as needed to assist with the user's requests.

# Key Information

- Personal Information: Use Apple Note titled "Personal Information" for relevant personal details.
- Professional Information: Use Apple Note titled "Professional Information" for relevant professional details.
`;

const responseStream = query({
	prompt,
	options: {
		model: "claude-sonnet-4-5-20250929",
		systemPrompt: SYSTEM_PROMPT,
		mcpServers: {
			appleNotes: appleNotesServer,
			appleCalendar: appleCalendarServer,
			appleContacts: appleContactsServer,
		},
		maxTurns: 10,
		allowedTools: [
			"Read",
			"mcp__appleNotes__searchNotes",
			"mcp__appleNotes__createNote",
			"mcp__appleNotes__listNotes",
			"mcp__appleNotes__getNoteContent",
			"mcp__appleNotes__editNote",
			"mcp__appleCalendar__createEvent",
			"mcp__appleCalendar__listEvents",
			"mcp__appleCalendar__getEventDetails",
			"mcp__appleCalendar__deleteEvent",
			"mcp__appleCalendar__getTodayEvents",
			"mcp__appleCalendar__searchEvents",
			"mcp__appleCalendar__updateEvent",
			"mcp__appleCalendar__getEventDetails",
			"mcp__appleContacts__createContact",
			"mcp__appleContacts__listContacts",
			"mcp__appleContacts__getContact",
			"mcp__appleContacts__searchContacts",
			"mcp__appleContacts__deleteContact",
		],
		settingSources: ["project"], // Required to load CLAUDE.md from project
	},
});

const contactsManager = new ContactsManager();

contactsManager
	.getContact("Rhonda Nance")
	.then((contact) => {
		console.log("Contact details for Rhonda Nance:", contact);
	})
	.catch((error) => {
		console.error("Error retrieving contact:", error);
	});

// Process streaming responses
for await (const response of responseStream) {
	let sessionId = null;
	// The first message is a system init message with the session ID
	if (response.type === "system" && response.subtype === "init") {
		sessionId = response.session_id;
		console.log(`Session started with ID: ${sessionId}`);
		// You can save this ID for later resumption
	} else if (response.type === "result" && response.subtype === "success") {
		console.log(response.result);
	} else if (
		response.type === "assistant" &&
		response.message.content[0].type === "tool_use"
	) {
		console.log(`Using tool: ${response.message.content[0].name}`);
		console.log(JSON.stringify(response.message.content[0].input, null, 2));
	}
}
