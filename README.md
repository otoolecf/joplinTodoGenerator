# Joplin Todo Generator


A Joplin plugin to make daily note-taking easier. This plugin will aggregate lines with certain keywords from various notes and link back to the original for easy, consolidated reference. The plugin will also automatically append timestamps to notes being actively worked on for general record-keeping.

## List Generator

The following keywords are supported. Note that these keywords are case-sensitive and require the colon as well.

- `TODO:` Creates a list item in a master note called `Todos`. List items are checkbox style and can be crossed out.
- `TIP:` Creates a list item in a master note called `Tips`. List items are normal list bullets. 
- `IDEA:` Creates a list item in a master note called `Ideas`. List items are normal list bullets. 

When one of the keywords is found on an open note, the plugin will take the line and add it to its respective master note if not already there. This will also work in real-time notetaking, and will not add to the master note until a newline is encountered. This prevents it from being added to the master note before the full line is finished typing. 

Each list item in the master note is followed by a link to the note it was created from, along with the line number it was found. Clicking the link in the markdown render view will take you to the source note and approximate location.

The `Todos` note list has the added functionality of checkbox style items. When items are completed by checking the box, the line will be appended with a timestamp of the completion date, then moved to a note called `Done Todos`. Once moved to `Done Todos`, the line item in the original note will be struckthrough. 

## Timestamps 

In addition to the list functionality, timestamps will automatically be generated in normal notes that are not one of the special cases above. Timestamps are only generated upon opening a note. 

There are 2 types of timestamp categories: timestamp headers and normal timestamps. Timestmap headers feature a newline in the format `======== 5/22/2022, 09:31:41`, and will be appended to the note when 24 hours has passed since the last timestamp header. Normal timestamps are in the format `5/22/2022, 09:31:41` and will be appended when more than 4 hours have passed since the last timestamp or timestamp header.

If timestamp behavior is not desired in a certain note, the following line can be added:

`\\ NO TIMESTAMP`

When this is found anywhere in a note, timestamp behavior will no longer occur.


General Joplin plugin info below.

---

# Joplin Plugin

This is a template to create a new Joplin plugin.

The main two files you will want to look at are:

- `/src/index.ts`, which contains the entry point for the plugin source code.
- `/src/manifest.json`, which is the plugin manifest. It contains information such as the plugin a name, version, etc.

## Building the plugin

The plugin is built using Webpack, which creates the compiled code in `/dist`. A JPL archive will also be created at the root, which can use to distribute the plugin.

To build the plugin, simply run `npm run dist`.

The project is setup to use TypeScript, although you can change the configuration to use plain JavaScript.

## Updating the plugin framework

To update the plugin framework, run `npm run update`.

In general this command tries to do the right thing - in particular it's going to merge the changes in package.json and .gitignore instead of overwriting. It will also leave "/src" as well as README.md untouched.

The file that may cause problem is "webpack.config.js" because it's going to be overwritten. For that reason, if you want to change it, consider creating a separate JavaScript file and include it in webpack.config.js. That way, when you update, you only have to restore the line that include your file.
