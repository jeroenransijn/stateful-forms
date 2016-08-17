var browserify = require('browserify');
var gulp = require('gulp');
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');

gulp.task('build', function() {
	console.log('build');
	return browserify({
			entries: './src/stateful-forms.js',
			debug: true
		})
		.bundle()
		.on('error', gutil.log.bind(gutil, 'Browserify Error'))
		//Pass desired output filename to vinyl-source-stream
		.pipe(source('stateful-forms.js'))
		// Start piping stream to tasks!
		.pipe(gulp.dest('./dist/'));
});


gulp.task('watch', function () {
	gulp.watch('./src/**/*', ['build']);
});
