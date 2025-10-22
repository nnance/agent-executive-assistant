import "dotenv/config";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { appleNotesServer } from "./apple-tools/apple-notes.js";

// Parse the first command line argument as the prompt
const prompt = process.argv[2];

if (!prompt) {
	console.error("Error: Please provide a prompt as the first argument");
	console.error('Usage: npm start "Your prompt here"');
	process.exit(1);
}

const SYSTEM_PROMPT = `
You are an executive assistant AI agent with access to Apple Notes on the user's Mac. 
Use the provided tools to manage and retrieve notes as needed to assist with the user's requests.

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
		},
		maxTurns: 10,
		allowedTools: [
			"Read",
			"mcp__appleNotes__searchNotes",
			"mcp__appleNotes__createNote",
			"mcp__appleNotes__listNotes",
			"mcp__appleNotes__getNoteContent",
			"mcp__appleNotes__editNote",
		],
		settingSources: ["project"], // Required to load CLAUDE.md from project
	},
});

// Process streaming responses
for await (const response of responseStream) {
	if (response.type === "result" && response.subtype === "success") {
		console.log(response.result);
	} else if (
		response.type === "assistant" &&
		response.message.content[0].type === "tool_use"
	) {
		console.log(`Using tool: ${response.message.content[0].name}`);
		console.log(JSON.stringify(response.message.content[0].input, null, 2));
	}
}
