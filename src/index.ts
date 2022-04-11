import joplin from 'api';
import { time, timeEnd } from 'console';

joplin.plugins.register({
	onStart: async function() {
		console.info('Hello world. Test plugin started!');

		
		async function addTimestamp() {
			try {
				const note = await joplin.workspace.selectedNote();
				if (note) {
					let last_header = findLastTimeHeader(note.body);
					console.log("addTimestamp: Last timestamp header: ", last_header);
					let new_timestamp = generateTimestamp(last_header.line_data);
					console.log("New timestamp: ", new_timestamp);
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
	lines.forEach((line,i) => {
		let header = {line_data: undefined, line_num: undefined};
		if (line && line.match(/===/)) {
			header.line_data = line;
			header.line_num = i;
			time_headers.push(header);
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
		if (hours_passed) {
			if (hours_passed > 4 || hours_passed < 0) {
				console.log("New timestamp needed. Hours passed: ", hours_passed);
				if (hours_passed > 24 || hours_passed < 0) {
					append_str =  `======== ${current_datetime_str}\n`;
				} else {
					append_str = `${current_datetime}\n`;
				}
			}
			console.log("string to append: ", append_str);
		} else {
			//no timestamp passed in, make a new one
			append_str =  `======== ${current_datetime_str}\n`;
		}
		console.log("New timestamp: ", append_str);
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
	// dates will look like 4/10/2022, 12:09:11 PM or 08/04/2022 10:15, 4/10/2022, 12:11:13 PM all locale time 
	let date_match = str.match(/\d{1,2}\/\d{1,2}\/\d{4}.?\s\d{2}:\d{2}:?(\d{2})?(\s[AP]M)?/);
	if (!date_match || !date_match.length) return;
	let date_millis = Date.parse(date_match[0]);
	let date = new Date(date_millis);
	console.log("convertDateFromString: date: ", date);
	return date;
}