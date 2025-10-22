import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export interface Note {
	id: string;
	name: string;
	body: string;
}

export class NotesManager {
	private execAsync = promisify(exec);

	async executeAppleScript(script: string) {
		try {
			const { stdout, stderr } = await this.execAsync(
				`osascript -e '${script}'`,
			);
			if (stderr) console.error(`AppleScript error: ${stderr}`);
			return stdout.trim();
		} catch (error: unknown) {
			console.error(`Error executing AppleScript: ${(error as Error).message}`);
			return null;
		}
	}

	async searchNotes(query: string): Promise<Note[] | null> {
		const script = `
      tell application "Notes"
        set searchResults to ""
        repeat with n in notes
          if (name of n contains "${query}") or (body of n contains "${query}") then
            if searchResults is not "" then
              set searchResults to searchResults & ":::"
            end if
            set searchResults to searchResults & (id of n) & "|||" & (name of n) & "|||" & (body of n)
          end if
        end repeat
        return searchResults
      end tell
    `;

		const result = await this.executeAppleScript(script);
		if (result) {
			const noteStrings = result.split(":::");
			const notes: Note[] = noteStrings.map((noteStr) => {
				const [id, name, body] = noteStr.split("|||");
				return { id, name, body } as Note;
			});
			return notes;
		}
		return null;
	}

	async createNote(title: string, body: string = "") {
		const script = `
      tell application "Notes"
        make new note with properties {name:"${title}", body:"${body}"}
        return "Note created: ${title}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		return result;
	}

	async editNote(noteTitle: string, newBody: string) {
		const script = `
      tell application "Notes"
        repeat with n in notes
          if name of n is "${noteTitle}" then
            set body of n to "${newBody}"
            return "Note updated: ${noteTitle}"
          end if
        end repeat
        return "Note not found: ${noteTitle}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		return result;
	}

	async listNotes(): Promise<Note[] | null> {
		const script = `
      tell application "Notes"
        set noteList to ""
        repeat with n in notes
          if noteList is not "" then
            set noteList to noteList & ":::"
          end if
          set noteList to noteList & (id of n) & "|||" & (name of n) & "|||" & (body of n)
        end repeat
        return noteList
      end tell
    `;

		const result = await this.executeAppleScript(script);
		if (result) {
			const noteStrings = result.split(":::");
			const notes: Note[] = noteStrings.map((noteStr) => {
				const [id, name, body] = noteStr.split("|||");
				return { id, name, body } as Note;
			});
			return notes;
		}
		return null;
	}

	async getNoteContent(noteTitle: string) {
		const script = `
      tell application "Notes"
        repeat with n in notes
          if name of n is "${noteTitle}" then
            return body of n
          end if
        end repeat
        return "Note not found: ${noteTitle}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		return result;
	}
}
// Reuse a single NotesManager instance to avoid recreating event listeners
const notesManager = new NotesManager();

export const appleNotesServer = createSdkMcpServer({
	name: "apple notes",
	version: "1.0.0",
	tools: [
		tool(
			"createNote",
			"Create a new note in Apple Notes",
			{
				title: z.string().describe("Title of the note"),
				body: z
					.string()
					.optional()
					.default("")
					.describe("Body content of the note"),
			},
			async (args) => {
				try {
					const result = await notesManager.createNote(args.title, args.body);

					return result
						? { content: [{ type: "text", text: result }] }
						: { content: [{ type: "text", text: "Failed to create note." }] };
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Invalid expression - ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"searchNotes",
			"Search notes in Apple Notes",
			{
				query: z.string().describe("Search query string"),
			},
			async (args) => {
				try {
					console.log(
						"Searching notes with query:",
						JSON.stringify(args, null, 2),
					);
					const result = await notesManager.searchNotes(args.query);

					return result
						? { content: [{ type: "text", text: result }] }
						: { content: [{ type: "text", text: "No matching notes found." }] };
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Invalid expression - ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"editNote",
			"Edit an existing note in Apple Notes",
			{
				noteTitle: z.string().describe("Title of the note to edit"),
				newBody: z.string().describe("New body content for the note"),
			},
			async (args) => {
				try {
					const result = await notesManager.editNote(
						args.noteTitle,
						args.newBody,
					);

					return result
						? { content: [{ type: "text", text: result }] }
						: { content: [{ type: "text", text: "Failed to edit note." }] };
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Invalid expression - ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool("listNotes", "List all notes in Apple Notes", {}, async () => {
			try {
				const result = await notesManager.listNotes();

				return result
					? { content: [{ type: "text", text: result }] }
					: { content: [{ type: "text", text: "No notes found." }] };
			} catch (error: unknown) {
				return {
					content: [
						{
							type: "text",
							text: `Error: Invalid expression - ${(error as Error).message}`,
						},
					],
				};
			}
		}),
		tool(
			"getNoteContent",
			"Get the content of a specific note in Apple Notes",
			{
				noteTitle: z.string().describe("Title of the note to retrieve"),
			},
			async (args) => {
				try {
					console.log("Getting content for note:", args);
					const result = await notesManager.getNoteContent(args.noteTitle);

					return result
						? { content: [{ type: "text", text: result }] }
						: { content: [{ type: "text", text: "Note not found." }] };
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: Invalid expression - ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
	],
});
