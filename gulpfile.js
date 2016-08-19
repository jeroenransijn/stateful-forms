'use strict';

var browserify = require('browserify');
var gulp = require('gulp');
var gutil = require('gulp-util');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');

function b () {
  return browserify({
    entries: './src/stateful-forms.js',
    debug: true
  });
}

gulp.task('build', function() {
  return b().bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('stateful-forms.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
        .on('error', gutil.log)
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('build-min', function() {
  return b().bundle()
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('stateful-forms.min.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
        .on('error', gutil.log)
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist/'));
});


gulp.task('watch', function () {
  gulp.watch('./src/**/*', ['build']);
});
