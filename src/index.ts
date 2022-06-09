import { remove } from '@vue/shared';
import joplin from 'api';
import JoplinSettings from 'api/JoplinSettings';
import { time, timeEnd } from 'console';

// TODO: update line numbers of todos?


const TODO_TITLE = "Todos";
const DONE_TODO_TITLE = "Done Todos";
const TIP_TITLE = "Tips";
const IDEA_TITLE = "Ideas";
// don't want to timestamp on special notes
const reserved_notes = [TODO_TITLE, DONE_TODO_TITLE, TIP_TITLE, IDEA_TITLE];
const note_keywords = [
	{note_title: TODO_TITLE, keyword: "TODO:"},
	{note_title: TIP_TITLE, keyword: "TIP:"},
	{note_title: IDEA_TITLE, keyword: "IDEA:"},
];
// const keywords = ["TODO", "TIP", "IDEA"];
const special_command_marker = "//";
const ignore_timestamp_command = "NO TIMESTAMP";
let last_line = {content: undefined, index: undefined};
const date_regex = /\d{1,2}\/\d{1,2}\/\d{2,4}.?\s\d{1,2}:\d{2}:?(\d{2})?(\s[AP]M)?/;

joplin.plugins.register({
	onStart: async function() {
		console.info('Starting todo generator plugin!');
		await joplin.workspace.onNoteSelectionChange(() => {
			//fires when new note selected
			logicHandler();
		});
		await joplin.workspace.onNoteChange(async () => {
			// runs when note changes
			logicHandler();
		});
		//runs when plugin starts
		logicHandler(true);

	},
});

async function logicHandler(start=undefined) {
	try {
		const note = await joplin.workspace.selectedNote();
		// console.log("logicHandler: note.title: ", note.title);
		if (note) {
			if (!reserved_notes.includes(note.title)) {
				// console.log("note found. Note id: ", note.id);
				let note_changed = await noteChangeChecker(note);
				if (!note_changed && !start) return;
				let new_timestamp = await addTimestamp(note.body)
				if (new_timestamp) {
					console.log("time for new timestamp! appending to note...")
					await apppendToNote(note.id, note.body, new_timestamp, true);
				}
				let keyword_items = findKeywords(note.body);
				// console.log("logicHandler: found keywords: ", keyword_items);
				if (keyword_items && keyword_items.length) {
					console.log("logicHandler: creating keyword items!");
					for (let i=0; i<keyword_items.length; i++) {
						let item = keyword_items[i];
						await createListItem(note, item.line, item.pos, item.note_keyword);
					}
				}
			} else {
				// found todo note
				if (note.title === TODO_TITLE) {
					await checkIfDoneTodos(note);
				}
			}
		}
	} catch(err){
		console.log("ERROR: addTimestamp: ", err.message);
	}
}

async function noteChangeChecker(note) {
	// returns true if the current note has changed significantly (newline, etc)
	let note_changed = false;
	let lines = note.body.split('\n');
	if (lines && lines.length) {
		let current_line_index = lines.length - 1;
		let current_line = lines.pop();
		if (last_line.index) {
			// If length is different, should fire
			// If last line is different, should fire
			if (last_line.index !== current_line_index || (last_line.content && !current_line.includes(last_line.content))) {
				console.log("noteChangeChecker: significant change detected!");
				note_changed = true;
			}
		}
		last_line.content = current_line;
		last_line.index = current_line_index;
		// console.log("last_line: ", last_line);
	}
	return note_changed;
}

async function addTimestamp(note_body) {
	// check if special handler sequence exists in body
	// if so, execute commands
	let lines = note_body.split('\n');
	let special_lines = lines.filter(line => line.includes(special_command_marker));
	// console.log("addTimestamp: special lines: ", special_lines);
	if (special_lines) {
		let ignore_command = special_lines.find(line => line.includes(ignore_timestamp_command));
		if (ignore_command) {
			console.log("command found: ", ignore_command);
			return;
		}
	}
	let last_header_obj = findLastTimeHeader(note_body);
	console.log("addTimestamp: Last timestamp header: ", last_header_obj);
	let last_header;
	if (last_header_obj && last_header_obj.header) last_header = last_header_obj.header
	let new_timestamp = generateTimestamp(last_header);
	// console.log("generateTimestamp result: ", new_timestamp);
	return new_timestamp;
}

function findLastTimeHeader(note_body) {
	let time_headers = [];
	let lines = note_body.split('\n');
	if(!lines || !lines.length) return;
	lines.forEach((line,i) => {
		if (line && line.match(/===/)) {
			time_headers.push({header: line, pos: i})
		}
	});
	return time_headers.pop();
}

function getHoursPassed(last_header) {
	let current_datetime = new Date(Date.now());
	let last_datetime = convertDateFromString(last_header);
	let hours_passed = getTimeDiff(current_datetime, last_datetime);
	console.log("getHoursPassed: ", hours_passed);
	return hours_passed;
}

function newTimestampStr() {
	let current_datetime = new Date(Date.now());
	let current_datetime_str = current_datetime.toLocaleString('en-US', {hour12: false});
	return current_datetime_str;
}
function generateTimestamp(last_header) {
	//check if === separator exists yet
	//if no timeheader, set
	//if timeheader, check if full day has passed
	//set timestamp on current line regardless if > 4 hrs since last
	let current_datetime_str = newTimestampStr();
	let hours_passed;
	if (last_header) hours_passed = getHoursPassed(last_header);
	let append_str;
	if (last_header && hours_passed) {
		if (hours_passed > 4 || hours_passed < 0) {
			console.log("generateTimestamp: New timestamp needed. Hours passed: ", hours_passed);
			if (hours_passed > 12 || hours_passed < 0) {
				append_str =  `======== ${current_datetime_str}\n`;
			} else {
				append_str = `${current_datetime_str}\n`;
			}
		}
	}
	else {
		//if no timestamp passed in, make a new one
		if (!last_header) append_str =  `======== ${current_datetime_str}\n`;
	}
	// console.log("New timestamp: ", append_str);
	return append_str;
}

function getTimeDiff(a_date, b_date){
	if (a_date instanceof Date && b_date instanceof Date) {
		//assumes type date
		//Returns hours difference, a-b
		let a_millis = a_date.getTime();
		let b_millis = b_date.getTime();
		let diff_millis = a_millis - b_millis;
		//convert millis to hours 
		let diff_hours = diff_millis/1000/60/60;
		return diff_hours;
	}
	
}

function convertDateFromString(str) {
	// dates will look like 4/10/2022, 12:09:11 PM or 08/04/2022 10:15, all locale time 
	let date_match = str.match(date_regex);
	// console.log("convertDateFromString: date_match: ", date_match);
	if (!date_match || !date_match.length) return;
	let date_millis = Date.parse(date_match[0]);
	let date = new Date(date_millis);
	return date;
}

async function updateLine(id, note_body, new_str, line_idx, current_note) {
	try {
		//adjust note body
		let lines = note_body.split('\n');
		lines[line_idx] = new_str;
		console.log("updateLine: idx: ", line_idx, " new_str: ", new_str);
		let new_body = lines.join("\n");
		await joplin.data.put(['notes', id], null, { body: new_body });
		if (current_note) {
			console.log("current_note, refreshing note...");
			await joplin.commands.execute('editor.setText', new_body);
		}
		return;
	} catch (err) {
		console.log("ERROR: updateLine: ", err);
	}
};

async function removeLine(id, note_body, line_idx, clean_empty, current_note){
	try {
		let lines = note_body.split('\n');
		let removed = lines.splice(line_idx, 1);
		console.log("removed line: ", removed);
		if (clean_empty) {
			// remove lines with no info from note 
			console.log("removeLine: clean_empty true, cleaning note...");
			let clean_lines = [];
			lines.forEach(line => {
				if (line.trim()) clean_lines.push(line);
			});
			lines = clean_lines;
		}
		let new_body = lines.join("\n");
		await joplin.data.put(['notes', id], null, { body: new_body });
		if (current_note) {
			console.log("current_note, refreshing note...");
			await joplin.commands.execute('editor.setText', new_body);
		}
		return removed;
	} catch (err) {
		console.log("ERROR: updateLine: ", err);
	}
}

async function apppendToNote(id, note_body, append_str, current_note) {
	try {
		// Set the note body
		// If append_str already included, DO NOT APPEND
		console.log("appendToNote noteId: ", id, ", str: ",append_str);
		if (note_body.includes(append_str)) {
			console.log("Note already includes append_str.");
			return;
		}
		let full_body = note_body + "\n" + append_str;
		await joplin.data.put(['notes', id], null, { body: full_body });
		// need to setText to update editor UI, current bug, see joplin #5955 on github
		if (current_note) {
			console.log("current_note, refreshing note...");
			await joplin.commands.execute('editor.setText', full_body);
		}
		return;
	} catch(err) {
		console.log("ERROR: appendToNote: ", err);
	}
}

function findKeywords(note_body, start_idx = 0) {
	// Finds keywords added after start_idx. If not provided, start_idx = 0;
	let keyword_instances = [];
	let lines = note_body.split('\n');
	if(lines && lines.length && start_idx < lines.length) {
		lines = lines.slice(start_idx);
		lines.forEach((line, l_idx) => {
			note_keywords.forEach(kw => {
				// ignore keywords that are already crossed out
				if (line.match(kw.keyword) && !line.match("~~")) keyword_instances.push({note_keyword: kw, line: line, pos: start_idx + l_idx});
			});
		});
	}
	return keyword_instances;
}

async function createListItem(src_note, text, idx, note_keyword) {
	try {
		if (!note_keyword || !note_keyword.keyword || !note_keyword.note_title) throw new Error("note_keyword required.");
		console.log("createListItem: creating item for note: ", note_keyword.note_title);
		let target_note;
		let split_str = note_keyword.keyword;
		let split_text = text.split(split_str);
		let clean_text = split_text[split_text.length - 1];
		let append_str;
		if (note_keyword.note_title == TODO_TITLE) {
			append_str ="- [ ] " + clean_text.trim() + " [" +src_note.title + ":" + idx + "](:/" + src_note.id + ") \n";
		} else {
			append_str = "- " + clean_text.trim() + " [" +src_note.title + ":" + idx + "](:/" + src_note.id + ") \n";
		}
		let existing_notes = await joplin.data.get(['notes'], {query: note_keyword.title, fields: ['id', 'title', 'body']});
		existing_notes = existing_notes.items;
		if (existing_notes && existing_notes.length) {
			target_note = existing_notes.find(n => n.title === note_keyword.note_title);
			console.log("target_note: ", target_note);
		} 
		if (target_note) {
			if (!target_note.body.includes(clean_text)) {
				await apppendToNote(target_note.id, target_note.body, append_str, false);
			} else {
				console.log("createListItem: List already includes clean_text: ", clean_text);
			}
		} else {
			//create the target note
			console.log("createListItem: no todo_note found. Creating new note!");
			let new_note_params = {"title": note_keyword.note_title, "body": append_str};
			await joplin.data.post(['notes'], null, new_note_params);
		}
		return;
	} catch(err) {
		console.log("ERROR: createListItem: ", err.message);
	}
}

async function addDoneTodo(todo_text) {
	try {
		let done_note;
		let existing_notes = await joplin.data.get(['notes'], {query: DONE_TODO_TITLE, fields: ['id', 'title', 'body']});
		existing_notes = existing_notes.items;
		if (existing_notes && existing_notes.length) {
			done_note = existing_notes.find(n => n.title === DONE_TODO_TITLE);
			console.log("todo_note: ", done_note);
		} 
		if (done_note) {
			if (!done_note.body.includes(todo_text)) {
				await apppendToNote(done_note.id, done_note.body, todo_text, false);
			} else {
				console.log("addDoneTodo: Todo list already includes todo_text: ", todo_text);
			}
		} else {
			//create the done note
			console.log("addDoneTodo: no todo_note found. Creating new note!");
			let new_todos_params = {"title": DONE_TODO_TITLE, "body": todo_text};
			await joplin.data.post(['notes'], null, new_todos_params);
		}
		return;
	} catch(err) {
		console.log("ERROR: addDoneTodo: ", err.message);
	}
}

async function todoComplete(todo_line) {
	console.log("todocomplete, finding the note info now!");
 	let note_info = todo_line.match(/\[([a-zA-Z0-9.\s-]+:[0-9]+)\]\(:\/([a-z0-9]+)\)/);
	console.log("todoComplete: note_info: ", note_info);
	if (note_info && note_info.length) {
		let full_note = note_info[0];
	 	let titleLine = note_info[1].split(":");
		let noteTitle = titleLine[0];
		let noteLine = titleLine[1];
		let noteId = note_info[2];
		let target = await joplin.data.get(['notes', noteId], {fields: ['id', 'title', 'body']});
		if (target) {
			let lines = target.body.split('\n');
			let old_str = lines[noteLine];
			let split_line = old_str.split("TODO");
			let new_str = split_line.join("~~TODO");
			new_str = new_str + "~~";
			await updateLine(noteId, target.body, new_str, noteLine, undefined);
		}
	}
	return;
}


async function checkIfDoneTodos(current_note) {
	try {
		console.log("checking for done todos!");
		if (current_note.title !== TODO_TITLE) return;
		let lines = current_note.body.split('\n');
		for(let i=0; i <lines.length; i++){
			let line = lines[i];
			if (line.match(/-\s\[x\]/)) {
				let date_match = line.match(date_regex);
				if (!date_match) {
					console.log("found line without timestamp, need to cross out todo in original note");
					// process done todo and add timestmap
					await todoComplete(line);
					// add timestamp to todo line
					let new_str = line + newTimestampStr();
					// await updateLine(current_note.id, current_note.body, new_str , i, true);
					// move to done todos
					await addDoneTodo(new_str);
					// remove done todo from todos list
					let done_line = await removeLine(current_note.id, current_note.body, i, true, true);	
				}
			}
		}
		return;
	} catch (err) {
		console.log("ERROR: checkIfDoneTodos: ", err);
	}
}

