class BatmanApp.ApplicationControllerTest extends Batman.ControllerTestCase
  setup: =>
    @subject = new BatmanApp.ApplicationController

  @test 'is not null', ->
    @assert @subject

(new BatmanApp.ApplicationControllerTest).runTests()
