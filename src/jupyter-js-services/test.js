var index_1 = require('./index');
var BASEURL = 'http://localhost:8888';
var WSURL = 'ws://localhost:8888';
index_1.getKernelSpecs(BASEURL).then(function (kernelSpecs) {
    return index_1.startNewKernel({
        baseUrl: BASEURL,
        wsUrl: WSURL,
        name: kernelSpecs.default,
    });
}).then(function (kernel) {
    index_1.getConfigSection('notebook', BASEURL).then(function (section) {
        var defaults = { default_cell_type: 'code' };
        var config = new index_1.ConfigWithDefaults(section, defaults, 'Notebook');
        console.log(config.get('default_cell_type')); // 'code'
        config.set('foo', 'bar').then(function (data) {
            console.log(data.foo); // 'bar'
        });
    });
});
//# sourceMappingURL=test.js.map