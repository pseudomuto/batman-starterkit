# Exports an object that defines
# *  all of the configuration needed by the projects'
# *  depended-on grunt tasks.
# *
# * You can find the parent object in: node_modules/lineman/config/application.coffee
#
module.exports = require(process.env["LINEMAN_MAIN"]).config.extend("application",

  # html5push state simulation
  server:
    pushState: false

  # configure lineman to load additional tasks form npm
  loadNpmTasks: [
    "grunt-batman-templates"
    "grunt-concat-sourcemap"
  ]

  # we don't use the lineman default concat, handlebars, and jst tasks by default
  removeTasks:
    common: ["concat", "handlebars", "jst"]

  appendTasks:
    common: ["concat_sourcemap"]

  # swaps concat_sourcemap in place of vanilla concat
  prependTasks:
    common: ["batman_templates"]

  # generates a batman template precache into Batman.View.store
  batman_templates:
    options:
      templateFolder: "app/html"
    files:
      src: "<%= files.batman_html %>"
      dest: "<%= files.batman_viewstore %>"

  # generates a sourcemap for js, specs, and css with inlined sources
  # grunt-angular-templates expects that a module already be defined to inject into
  # this configuration orders the template inclusion _after_ the app level module
  concat_sourcemap:
    options:
      sourcesContent: true

    js:
      src: ["<%= files.js.vendor %>", "<%= files.coffee.generated %>", "<%= files.batman_viewstore %>"]
      dest: "<%= files.js.concatenated %>"

    spec:
      src: ["<%= files.js.specHelpers %>", "<%= files.coffee.generatedSpecHelpers %>", "<%= files.js.spec %>", "<%= files.coffee.generatedSpec %>"]
      dest: "<%= files.js.concatenatedSpec %>"

    css:
      src: ["<%= files.less.generatedVendor %>", "<%= files.sass.generatedVendor %>", "<%= files.css.vendor %>", "<%= files.less.generatedApp %>", "<%= files.sass.generatedApp %>", "<%= files.css.app %>"]
      dest: "<%= files.css.concatenated %>"


  # configures grunt-watch-nospawn to listen for changes and swaps the
  # watch target concat with concat_sourcemap
  watch:
    batman_templates:
      files: ["<%= files.batman_html %>"]
      tasks: ["batman_templates", "concat_sourcemap:js"]

    js:
      files: ["<%= files.js.vendor %>"]
      tasks: ["concat_sourcemap:js"]

    coffee:
      files: "<%= files.coffee.app %>"
      tasks: ["coffee", "concat_sourcemap:js"]

    jsSpecs:
      files: ["<%= files.js.specHelpers %>", "<%= files.js.spec %>"]
      tasks: ["concat_sourcemap:spec"]

    coffeeSpecs:
      files: ["<%= files.coffee.specHelpers %>", "<%= files.coffee.spec %>"]
      tasks: ["coffee", "concat_sourcemap:spec"]

    css:
      files: ["<%= files.css.vendor %>", "<%= files.css.app %>"]
      tasks: ["concat_sourcemap:css"]

    less:
      files: ["<%= files.less.vendor %>", "<%= files.less.app %>"]
      tasks: ["less", "concat_sourcemap:css"]

    sass:
      files: ["<%= files.sass.vendor %>", "<%= files.sass.app %>"]
      tasks: ["sass", "concat_sourcemap:css"]
)
