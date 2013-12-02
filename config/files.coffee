# Exports an object that defines
# *  all of the paths & globs that the project
# *  is concerned with.
# *
# * The "configure" task will require this file and
# *  then re-initialize the grunt config such that
# *  directives like <config:files.js.app> will work
# *  regardless of the point you're at in the build
# *  lifecycle.
# *
# * You can find the parent object in: node_modules/lineman/config/files.coffee
#
module.exports = require(process.env["LINEMAN_MAIN"]).config.extend("files",
  pages:
    source: "app/layouts/**/*.*"

  img:
    app: "app/resources/img/**/*.*"
    root: "img"

  js:
    vendor: ["vendor/js/jquery.js", "vendor/js/batman.js", "vendor/js/**/*.js"]

  coffee:
    app: ["app/app.coffee", "app/**/*.coffee"]

  batman_html: ["app/html/**/*.html"]
  batman_viewstore: "generated/batman/view-store.js"

  css:
    app: "app/resources/css/**/*.css"

  sass:
    main: "app/resources/css/style.scss"
    app: "app/resources/css/**/*.scss"
    vendor: ["vendor/css/**/*.scss", "vendor/css/**/*.sass"]
    compile:
      paths: ["vendor/css/normalize.css", "vendor/css/**/*.css", "app/resources/css/**/*.scss"]
)
