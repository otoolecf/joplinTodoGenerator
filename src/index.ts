import joplin from 'api';
import { time, timeEnd } from 'console';

joplin.plugins.register({
	onStart: async function() {
		console.info('Hello world. Test plugin started!');
		async function addTimestamp() {
			try {
				const note = await joplin.workspace.selectedNote();
				if (note) {
					// console.log("note found. Note id: ", note.id);
					let last_header = findLastTimeHeader(note.body);
					console.log("addTimestamp: Last timestamp header: ", last_header);
					let new_timestamp = generateTimestamp(last_header);
					// console.log("generateTimestamp result: ", new_timestamp);
					if (new_timestamp) {
						console.log("time for new timestamp! appending to note...")
						await apppendToNote(note.id, note.body, new_timestamp, true);
					}
 				}
			} catch(err){
				console.log("ERROR: addTimestamp: ", err.message);
			}
		}
		await joplin.workspace.onNoteSelectionChange(() => {
			addTimestamp();
		});
		addTimestamp();

	},
});

function findLastTimeHeader(note_body) {
	let time_headers = [];
	let lines = note_body.split('\n');
	if(!lines || !lines.length) return;
	lines.forEach(line => {
		let header;
		if (line && line.match(/===/)) {
			header = line;
			time_headers.push(header);
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
		console.log("appendToNote noteId: ", id, ", str: ",append_str);
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