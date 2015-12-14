if(document.getElementById('entry1'))
var debug = impex.render(document.getElementById('entry1'),{
	name:'impex'
});

if(document.getElementById('entry2'))
impex.render(document.getElementById('entry2'),{
	bigger:false,
	toggleSize:function(){
		this.bigger = !this.bigger;
	}
});

if(document.getElementById('syntax-1'))
impex.render(document.getElementById('syntax-1'),{
	html:'<b>HTML</b>'
});

impex.filter('trim',{
    to:function(type){
        if(type === 'side'){
            return this.$value.replace(/^\s*|\s*$/mg,'');
        }
        return this.$value.replace(/\s/mg,'');
    }
}).filter('lower',{
    to:function(){
        return this.$value.toLowerCase();
    }
}).filter('cap',{
    to:function(){
        var cap = this.$value[0].toUpperCase();
        return (cap + this.$value.substr(1)).big();
    }
});
impex.filter('currency',{
    to:function(sym,decimal){
        var pair = this.$value.split('.');
        var inte = pair[0].replace(/\s/g,'');
        var integer = '';
        for(var i=0;i<inte.length;i++){
            integer += inte[i];
            if(i%3==0 && i+1<inte.length){
                integer += ',';
            }
        }
        return sym + ' ' + integer + parseFloat('0.'+pair[1]).toFixed(decimal).substr(1);
    }
});

if(document.getElementById('syntax-2'))
impex.render(document.getElementById('syntax-2'),{
	money : '4321234.5678'
});

if(document.getElementById('syntax-3'))
impex.render(document.getElementById('syntax-3'));

if(document.getElementById('each-1'))
impex.render(document.getElementById('each-1'),{
    numbers:[1,2,3,4],
    addNum:function(){
        this.numbers.push(this.numbers.length+1);
    },
    subNum:function(){
        this.numbers.pop();
    }
});

if(document.getElementById('each-2'))
impex.render(document.getElementById('each-2'),{
    numbers:[1,2,3,4]
});

if(document.getElementById('each-3'))
impex.render(document.getElementById('each-3'),{
    obj:{
        name:'white',
        color:'red',
        shape:'rect'
    }
});

if(document.getElementById('form-1'))
var debug = impex.render(document.getElementById('form-1'),{
    content:''
});
if(document.getElementById('form-2'))
var debug = impex.render(document.getElementById('form-2'),{
    names:[]
});
if(document.getElementById('form-3'))
var debug = impex.render(document.getElementById('form-3'),{
    name:''
});
if(document.getElementById('form-4'))
var debug = impex.render(document.getElementById('form-4'),{
    name:''
});
if(document.getElementById('form-5'))
var debug = impex.render(document.getElementById('form-5'),{
    content:''
});

impex.component('x-div',{
    $template : "<div {{=BINDPROPS}}>=={{=CONTENT}}==</div>"
})
if(document.getElementById('component-1'))
var debug = impex.render(document.getElementById('component-1'));

impex.component('x-button',{
    $restrict:{
        parents:'x-body'
    },
    $template:"<button >{{=CONTENT}}</button>"
});
impex.component('x-head',{
    $restrict:{
        children:'x-button'
    },
    $template:"<div><x-button>Button A</x-button></div>"
});
impex.component('x-body',{
    $restrict:{
        children:'x-button'
    },
    $template:"<span><x-button>Button B</x-button></span>"
});
if(document.getElementById('component-2'))
var debug = impex.render(document.getElementById('component-2'));

impex.directive('tip',{
    onInit : function(){//鼠标悬浮时提示内容
        this.on('mouseover',"showTip()");
    },
    showTip:function(){
        alert(this.$value);
    }
})

if(document.getElementById('directive-1'))
impex.render(document.getElementById('directive-1'));

if(document.getElementById('directive-2'))
impex.render(document.getElementById('directive-2'),new function(){
    this.clicks = {
        c1:function(i){
            alert('impex '+i)
        },
        c2:function(i){
            alert('soya2d '+i)
        }
    }
    this.btns = [
        {name:'Button_',click:'clicks.c1'},
        {name:'Button_',click:'clicks.c2'}
    ]
});

if(document.getElementById('filter-1'))
impex.render(document.getElementById('filter-1'));