module.exports = (lineman) ->
  config:
    images:
      files:
        "app/img/": "app/img"
        "app/resources/img/": "<%= files.img.app %>"

      root: "<%= files.img.root %>"
      dev:
        dest: "generated"

      dist:
        dest: "dist"
