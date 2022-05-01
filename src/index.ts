import joplin from 'api';
import JoplinSettings from 'api/JoplinSettings';
import { time, timeEnd } from 'console';

const TODO_TITLE = "Todos";
const keywords = ["TODO", "TIP", "IDEA"];
const special_command_marker = "//";
const ignore_timestamp_command = "NO TIMESTAMP";
let last_line = {content: undefined, index: undefined};

joplin.plugins.register({
	onStart: async function() {
		console.info('Hello world. Test plugin started!');
		async function logicHandler() {
			try {
				const note = await joplin.workspace.selectedNote();
				console.log("logicHandler: note.title: ", note.title);
				if (note && note.title !== TODO_TITLE) {
					// console.log("note found. Note id: ", note.id);
					let new_timestamp = await addTimestamp(note.body)
					if (new_timestamp) {
						console.log("time for new timestamp! appending to note...")
						await apppendToNote(note.id, note.body, new_timestamp, true);
					}
					let todo_items = findKeywords(note.body);
					console.log("logicHandler: found keywords: ", todo_items);
					todo_items = todo_items.filter(item => item.keyword === "TODO");
					console.log("logicHandler: found todos: ", todo_items);
					if (todo_items && todo_items.length) {
						console.log("logicHandler: creating todos!");
						for (let i=0; i<todo_items.length; i++) {
							let todo = todo_items[i];
							await createTodo(note.id, todo.line, todo.pos);
						}
					}
 				}
			} catch(err){
				console.log("ERROR: addTimestamp: ", err.message);
			}
		}
		await joplin.workspace.onNoteSelectionChange(() => {
			//fires when new note selected
			logicHandler();
		});
		await joplin.workspace.onNoteChange(async () => {
			// runs when note changes
			let note_changed = await noteChangeChecker();
			if (note_changed) {
				logicHandler();
			}
		});
		//runs when plugin starts
		logicHandler();

	},
});


async function noteChangeChecker() {
	// returns true if the current note has changed significantly (newline, etc)
	let note_changed = false;
	const note = await joplin.workspace.selectedNote();
	let lines = note.body.split('\n');
	if (lines && lines.length) {
		let current_line_index = lines.length - 1;
		let current_line = lines.pop();
		if (last_line.content && last_line.index) {
			if (last_line.index !== current_line_index && !current_line.includes(last_line.content)) {
				console.log("noteChangeChecker: significant change detected!");
				note_changed = true;
			}
		}
		last_line.content = current_line;
		last_line.index = current_line_index;
	}
	return note_changed;
}

async function addTimestamp(note_body) {
	// check if special handler sequence exists in body
	// if so, execute commands
	let lines = note_body.split('\n');
	let special_lines = lines.filter(line => line.includes(special_command_marker));
	console.log("addTimestamp: special lines: ", special_lines);
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
	// console.log("getHoursPassed: last_datetime: ", last_datetime);
	let hours_passed = getTimeDiff(current_datetime, last_datetime);
	console.log("getHoursPassed: ", hours_passed);
	return hours_passed;
}

function generateTimestamp(last_header) {
	//check if === separator exists yet
	//if no timeheader, set
	//if timeheader, check if full day has passed
	//set timestamp on current line regardless if > 4 hrs since last
	let current_datetime = new Date(Date.now());
	let current_datetime_str = current_datetime.toLocaleString();
	let hours_passed;
	if (last_header) hours_passed = getHoursPassed(last_header);
	let append_str;
	if (last_header && hours_passed) {
		if (hours_passed > 4 || hours_passed < 0) {
			console.log("generateTimestamp: New timestamp needed. Hours passed: ", hours_passed);
			if (hours_passed > 24 || hours_passed < 0) {
				append_str =  `======== ${current_datetime_str}\n`;
			} else {
				append_str = `${current_datetime_str}\n`;
			}
		}
		// console.log("generateTimestamp: string to append: ", append_str);
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
	let date_match = str.match(/\d{1,2}\/\d{1,2}\/\d{4}.?\s\d{1,2}:\d{2}:?(\d{2})?(\s[AP]M)?/);
	console.log("convertDateFromString: date_match: ", date_match);
	if (!date_match || !date_match.length) return;
	let date_millis = Date.parse(date_match[0]);
	let date = new Date(date_millis);
	// console.log("convertDateFromString: date: ", date);
	return date;
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
			keywords.forEach(kw => {
				if (line.match(kw)) keyword_instances.push({keyword: kw, line: line, pos: start_idx + l_idx});
			});
		});
	}
	return keyword_instances;
}


async function createTodo(src_id, todo_text, todo_idx) {
	try {
		let todo_note;
		let append_str = todo_text + " || src_note_id: " + src_id + " , src_idx: " + todo_idx;
		let existing_notes = await joplin.data.get(['notes'], {query: TODO_TITLE, fields: ['id', 'title', 'body']});
		existing_notes = existing_notes.items;
		console.log("createTodo: data GET result: ", existing_notes);
		if (existing_notes && existing_notes.length) {
			todo_note = existing_notes.find(n => n.title === TODO_TITLE);
			console.log("todo_note: ", todo_note);
		} 
		if (todo_note) {
			if (!todo_note.body.includes(todo_text)) {
				await apppendToNote(todo_note.id, todo_note.body, append_str, false);
			} else {
				console.log("createTodo: Todo list already includes todo_text: ", todo_text);
			}
		} else {
			//create the todo
			console.log("createTodo: no todo_note found. Creating new note!");
			let new_todos_params = {"title": TODO_TITLE, "body": append_str};
			await joplin.data.post(['notes'], null, new_todos_params);
		}
		//TODO: Link the todos to proper note
		//TODO: cross out old todos
		return;
	} catch(err) {
		console.log("ERROR: createTodo: ", err.message);
	}
}

