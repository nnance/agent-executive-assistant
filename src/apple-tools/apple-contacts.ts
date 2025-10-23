import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import z from "zod";

export interface Contact {
	id: string;
	name: string;
	emails: string[];
	phones: string[];
	organization?: string;
	birthday?: string;
}

export class ContactsManager {
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

	async searchContacts(query: string): Promise<Contact[] | null> {
		const script = `
      tell application "Contacts"
        set searchResults to ""
        repeat with p in people
          if (name of p contains "${query}") or (organization of p contains "${query}") then
            if searchResults is not "" then
              set searchResults to searchResults & ":::"
            end if
            set contactInfo to (id of p) & "|||" & (name of p) & "|||"
            set emailList to ""
            repeat with e in emails of p
              if emailList is not "" then
                set emailList to emailList & ","
              end if
              set emailList to emailList & (value of e)
            end repeat
            set contactInfo to contactInfo & emailList & "|||"
            set phoneList to ""
            repeat with ph in phones of p
              if phoneList is not "" then
                set phoneList to phoneList & ","
              end if
              set phoneList to phoneList & (value of ph)
            end repeat
            set contactInfo to contactInfo & phoneList & "|||" & (organization of p) & "|||"
            try
              set birthdayValue to birth date of p
              set contactInfo to contactInfo & (birthdayValue as string)
            on error
              set contactInfo to contactInfo & ""
            end try
            set searchResults to searchResults & contactInfo
          end if
        end repeat
        return searchResults
      end tell
    `;

		const result = await this.executeAppleScript(script);
		if (result) {
			const contactStrings = result.split(":::");
			const contacts: Contact[] = contactStrings.map((contactStr) => {
				const [id, name, emailsStr, phonesStr, organization, birthday] =
					contactStr.split("|||");
				return {
					id,
					name,
					emails: emailsStr ? emailsStr.split(",") : [],
					phones: phonesStr ? phonesStr.split(",") : [],
					organization: organization || undefined,
					birthday: birthday || undefined,
				} as Contact;
			});
			return contacts;
		}
		return null;
	}

	async createContact(
		name: string,
		email?: string,
		phone?: string,
		organization?: string,
		birthday?: string,
	) {
		const script = `
      tell application "Contacts"
        set newPerson to make new person with properties {name:"${name}"${organization ? `, organization:"${organization}"` : ""}}
        ${email ? `make new email at end of emails of newPerson with properties {value:"${email}"}` : ""}
        ${phone ? `make new phone at end of phones of newPerson with properties {value:"${phone}"}` : ""}
        ${birthday ? `set birth date of newPerson to date "${birthday}"` : ""}
        save
        return "Contact created: ${name}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		return result;
	}

	async listContacts(): Promise<Contact[] | null> {
		const script = `
      tell application "Contacts"
        set contactList to ""
        repeat with p in people
          if contactList is not "" then
            set contactList to contactList & ":::"
          end if
          set contactInfo to (id of p) & "|||" & (name of p) & "|||"
          set emailList to ""
          repeat with e in emails of p
            if emailList is not "" then
              set emailList to emailList & ","
            end if
            set emailList to emailList & (value of e)
          end repeat
          set contactInfo to contactInfo & emailList & "|||"
          set phoneList to ""
          repeat with ph in phones of p
            if phoneList is not "" then
              set phoneList to phoneList & ","
            end if
            set phoneList to phoneList & (value of ph)
          end repeat
          set contactInfo to contactInfo & phoneList & "|||" & (organization of p) & "|||"
          try
            set birthdayValue to birth date of p
            set contactInfo to contactInfo & (birthdayValue as string)
          on error
            set contactInfo to contactInfo & ""
          end try
          set contactList to contactList & contactInfo
        end repeat
        return contactList
      end tell
    `;

		const result = await this.executeAppleScript(script);
		if (result) {
			const contactStrings = result.split(":::");
			const contacts: Contact[] = contactStrings.map((contactStr) => {
				const [id, name, emailsStr, phonesStr, organization, birthday] =
					contactStr.split("|||");
				return {
					id,
					name,
					emails: emailsStr ? emailsStr.split(",") : [],
					phones: phonesStr ? phonesStr.split(",") : [],
					organization: organization || undefined,
					birthday: birthday || undefined,
				} as Contact;
			});
			return contacts;
		}
		return null;
	}

	async getContact(contactName: string): Promise<Contact | null> {
		const script = `
      tell application "Contacts"
        repeat with p in people
          if name of p is "${contactName}" then
            set contactInfo to (id of p) & "|||" & (name of p) & "|||"
            set emailList to ""
            repeat with e in emails of p
              if emailList is not "" then
                set emailList to emailList & ","
              end if
              set emailList to emailList & (value of e)
            end repeat
            set contactInfo to contactInfo & emailList & "|||"
            set phoneList to ""
            repeat with ph in phones of p
              if phoneList is not "" then
                set phoneList to phoneList & ","
              end if
              set phoneList to phoneList & (value of ph)
            end repeat
            set contactInfo to contactInfo & phoneList & "|||" & (organization of p) & "|||"
            try
              set birthdayValue to birth date of p
              set contactInfo to contactInfo & (birthdayValue as string)
            on error
              set contactInfo to contactInfo & ""
            end try
            return contactInfo
          end if
        end repeat
        return "Contact not found: ${contactName}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		if (result && !result.includes("Contact not found")) {
			const [id, name, emailsStr, phonesStr, organization, birthday] =
				result.split("|||");
			return {
				id,
				name,
				emails: emailsStr ? emailsStr.split(",") : [],
				phones: phonesStr ? phonesStr.split(",") : [],
				organization: organization || undefined,
				birthday: birthday || undefined,
			} as Contact;
		}
		return null;
	}

	async deleteContact(contactName: string) {
		const script = `
      tell application "Contacts"
        repeat with p in people
          if name of p is "${contactName}" then
            delete p
            return "Contact deleted: ${contactName}"
          end if
        end repeat
        return "Contact not found: ${contactName}"
      end tell
    `;

		const result = await this.executeAppleScript(script);
		return result;
	}
}

const contactsManager = new ContactsManager();

export const appleContactsServer = createSdkMcpServer({
	name: "apple contacts",
	version: "1.0.0",
	tools: [
		tool(
			"listContacts",
			"List all contacts in Apple Contacts",
			{},
			async () => {
				try {
					const result = await contactsManager.listContacts();

					return result
						? {
								content: [
									{
										type: "text",
										text: JSON.stringify(result, null, 2),
									},
								],
							}
						: {
								content: [
									{
										type: "text",
										text: "No contacts found.",
									},
								],
							};
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"searchContacts",
			"Search for contacts by name or organization",
			{
				query: z.string().describe("Search query string"),
			},
			async (args) => {
				try {
					const result = await contactsManager.searchContacts(args.query);

					return result
						? {
								content: [
									{
										type: "text",
										text: JSON.stringify(result, null, 2),
									},
								],
							}
						: {
								content: [
									{
										type: "text",
										text: "No matching contacts found.",
									},
								],
							};
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"getContact",
			"Get detailed information about a specific contact",
			{
				contactName: z
					.string()
					.describe("Full name of the contact to retrieve"),
			},
			async (args) => {
				try {
					const result = await contactsManager.getContact(args.contactName);

					return result
						? {
								content: [
									{
										type: "text",
										text: JSON.stringify(result, null, 2),
									},
								],
							}
						: {
								content: [
									{
										type: "text",
										text: `Contact not found: ${args.contactName}`,
									},
								],
							};
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"createContact",
			"Create a new contact in Apple Contacts",
			{
				name: z.string().describe("Full name of the contact"),
				email: z.string().optional().describe("Email address of the contact"),
				phone: z.string().optional().describe("Phone number of the contact"),
				organization: z
					.string()
					.optional()
					.describe("Organization of the contact"),
				birthday: z
					.string()
					.optional()
					.describe("Birthday in the format 'Monday, January 1, 2024'"),
			},
			async (args) => {
				try {
					const result = await contactsManager.createContact(
						args.name,
						args.email,
						args.phone,
						args.organization,
						args.birthday,
					);

					return result
						? {
								content: [
									{
										type: "text",
										text: result,
									},
								],
							}
						: {
								content: [
									{
										type: "text",
										text: "Failed to create contact.",
									},
								],
							};
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
		tool(
			"deleteContact",
			"Delete a contact from Apple Contacts",
			{
				contactName: z.string().describe("Full name of the contact to delete"),
			},
			async (args) => {
				try {
					const result = await contactsManager.deleteContact(args.contactName);

					return result
						? {
								content: [
									{
										type: "text",
										text: result,
									},
								],
							}
						: {
								content: [
									{
										type: "text",
										text: "Failed to delete contact.",
									},
								],
							};
				} catch (error: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${(error as Error).message}`,
							},
						],
					};
				}
			},
		),
	],
});
