class BatmanApp.AppTest extends Batman.TestCase
  @test 'root route points to examples#index', ->
    route = BatmanApp.get('dispatcher').routeForParams('/')
    @assertEqual 'examples', route.get('controller')
    @assertEqual 'index', route.get('action')

new BatmanApp.AppTest().runTests()
