-- Match the Free-plan upload cap. Larger source files are compressed in-browser.
update storage.buckets set file_size_limit = 52428800 where id = 'help-videos';
