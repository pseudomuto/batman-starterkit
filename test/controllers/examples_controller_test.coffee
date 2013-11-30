class BatmanApp.ExamplesControllerTest extends Batman.ControllerTestCase
  setup: =>
    @subject = new BatmanApp.ExamplesController

  @test '#routingKey is set correctly', ->
    @assertEqual 'examples', @subject.routingKey

(new BatmanApp.ExamplesControllerTest).runTests()
