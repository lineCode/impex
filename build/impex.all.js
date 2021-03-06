/*
 * impexjs is a powerful web application engine to build 
 * reactive webUI system
 *
 *
 * Copyright 2015-2017 MrSoya and other contributors
 * Released under the MIT license
 *
 * website: http://impexjs.org
 * last build: 2017-12-06
 */
!function (global) {
	'use strict';
/**
 * utils
 */
    function ext(from,to){
        var keys = Object.keys(from);
        for (var i=keys.length;i--;) {
            var k = keys[i];
            to[k] = from[k];
        }
    }
    function isObject(obj){
        return typeof(obj) === 'object' && obj !== null;
    }
    function isArray(obj){
        return obj instanceof Array;
    }
    function isString(obj){
        return typeof obj === 'string';
    }
    function isUndefined(obj){
        return obj === undefined;
    }
    function isFunction(obj){
        return obj instanceof Function;
    }

    function loadError(){
        error('can not fetch remote data of : '+this.url);
    }
    function loadTimeout(){
        error('load timeout : '+this.url);
    }
    function onload(){
        if(this.status===0 || //native
        ((this.status >= 200 && this.status <300) || this.status === 304) ){
            var txt = this.responseText;
            var obj = requirements[this.url];
            var cbks = obj.cbks;
            var name = obj.name;

            txt = txt.replace(/<!--[\s\S]*?-->/mg,'').trim();
            txt.match(/<\s*template[^<>]*>([\s\S]*)<\s*\/\s*template\s*>/img)[0];
            var tmpl = RegExp.$1;
            if(!tmpl){
                error('can not find tag <template> in component file');
                return;
            }

            var css = '';
            tmpl = tmpl.replace(/<\s*style[^<>]*>([\s\S]*?)<\s*\/\s*style\s*>/img,function(a,b){
                css += b;
                return '';
            });

            txt.match(/<\s*script[^<>]*\s*id\s*=\s*['"]impex['"][^<>]*>([\s\S]*?)<\s*\/\s*script\s*>/img)[0];
            var modelStr = RegExp.$1;
            var links = txt.match(/<link[^<>]+rel\s*=\s*['"]impex['"][^<>]+>/img);
            var registerComp = {};
            for(var i=links.length;i--;){
                var tmp = links[i];
                tmp.match(/href=['"](.*?)['"]/)[0];
                var href = RegExp.$1;
                tmp.match(/type=['"](.*?)['"]/)[0];
                var type = RegExp.$1;
                registerComp[type] = href;
            }

            var model = new Function('return ('+modelStr+')()')();

            //register
            for(var k in registerComp){
                impex.component(k,registerComp[k]);
            }

            model.template = tmpl.trim();
            
            var url = this.url;
            cbks.forEach(function(cbk){
                cbk(model,css.trim());
            });
            requirements[this.url] = null;
        }
    }

    var requirements = {};
    function loadComponent(name,url,cbk,timeout){
        if(!requirements[url]){
            requirements[url] = {name:name,cbks:[]};
            requirements[url].cbks.push(cbk);
        }else{
            requirements[url].cbks.push(cbk);
            return;
        }        

        var xhr = new XMLHttpRequest();
        xhr.open('get',url,true);
        xhr.timeout = timeout || 5000;
        xhr.ontimeout = loadTimeout;
        xhr.onerror = loadError;
        if(xhr.onload === null){
            xhr.onload = onload;
        }else{
            xhr.onreadystatechange = onload;
        }
        xhr.url = url;
        xhr.send(null);
    }
	var Observer = null;
	window.Proxy && !function(){
		function setArray(ary,index,value){
			if(isNaN(index))return;

			ary[index>>0] = value;
		}
		function delArray(ary,index){
			if(isNaN(index))return;

			ary.splice(index,1);
		}
		function observeData(handler,propChains,data,component){
			if(data && data.__im__propChain)return data;

			var t = isArray(data)?[]:{};
			for(var k in data){
				var o = data[k];
				if(isObject(o)){
					var pcs = propChains.concat();
					pcs.push(k);
					var tmp = observeData(handler,pcs,o,component);
					t[k] = tmp;
				}else{
					t[k] = o;
				}
			}
			Object.defineProperty(t,'__im__propChain',{enumerable: false,writable: false,value:propChains});
			
			var p = new Proxy(t, handler);
			
			var id = Date.now() + Math.random();
			Object.defineProperty(t,'__im__oid',{enumerable: false,writable: false,value:id});
			return p;
		}

		Observer = {
			observe:function(data,component){
				if(data && data.__im__propChain)return data;

				//build handler
				var handler = {
					comp:component,
				    // get: function(target, name){
				    //     return target[name];
				    // },
				    set: function(target,name,value) {
				    	var isAdd = !(name in target);

				    	var old = target[name];
				    	var v = value;
				    	if(old === v)return true;

				    	if(isObject(v)){
				    		var pcs = target.__im__propChain.concat();
							pcs.push(name);
				    		v = observeData(this,pcs,v,this.comp);
				    	}
				    	if(isArray(target)){
				    		setArray(target,name,v);
				    	}else{
					    	target[name] = v;
				    	}

				    	var path = target.__im__propChain;//.concat();

				    	var changeObj = {object:target,name:name,pc:path,oldVal:old,newVal:v,comp:this.comp,type:isAdd?'add':'update'};

				    	ChangeHandler.handle(changeObj);
				    	
				    	return true;
				    },
				    deleteProperty: function (target, name) {
				    	var old = target[name];

					    if(isArray(target)){
				    		delArray(target,name);
				    	}else{
				    		delete target[name];
				    	}

					    var path = target.__im__propChain;//.concat();

					    var changeObj = {object:target,name:name,pc:path,oldVal:old,comp:this.comp,type:'delete'};
				    	ChangeHandler.handle(changeObj);

					    return true;
					}
				};

				return observeData(handler,[],data,component);
			}
		};
	}();

	///////////////////////////////////////// fallback ///////////////////////////////////////////
	!window.Proxy && !function(){
		function getter(k){
			return this.__im__innerProps[k];
		}
		function setter(k,v){
			var old = this.__im__innerProps[k];
			if(old)clearObserve(old);
			if(isObject(v)){
	    		var pcs = this.__im__propChain.concat();
				pcs.push(k);
	    		v = observeData(pcs,v,this.__im__comp);
	    	}
			this.__im__innerProps[k] = v;

			var path = this.__im__propChain;
	    	
	    	handler([{
	    		name:k,
	    		target:this,
	    		oldVal:old,
	    		newVal:v,
	    		type:'update'
	    	}],true);
		}
		function observeData(propChains,data,component){
			if(data && data.__im__propChain)return data;
			
			var t = isArray(data)?[]:{};

			Object.defineProperty(t,'__im__innerProps',{enumerable: false,writable: true,value:{}});
			var props = {};

			var observeObj = {};
			for(var k in data){
				if(!data.hasOwnProperty(k))continue;

				var o = data[k];			
				if(isObject(o)){
					var pcs = propChains.concat();
					pcs.push(k);
					var tmp = observeData(pcs,o,component);
					t.__im__innerProps[k] = tmp;
				}else{
					t.__im__innerProps[k] = o;
				}

				//设置监控属性
				observeObj[k] = o;

				!function(k){
					props[k] = {
						get:function(){return getter.call(this,k)},
						set:function(v){setter.call(this,k,v)},
						enumerable:true,
						configurable:true
					};
				}(k);
			}

			Object.defineProperties(t,props);
			Object.defineProperty(t,'__im__propChain',{enumerable: false,writable: false,value:propChains});
			Object.defineProperty(t,'__im__comp',{enumerable: false,writable: false,value:component});

			var id = Date.now() + Math.random();
			Object.defineProperty(t,'__im__oid',{enumerable: false,writable: false,value:id});
			observedObjects.push({snap:observeObj,now:t,id:id});

			return t;
		}
		function dirtyCheck(){
			RAF(function(){
				for(var i=observedObjects.length;i--;){
					var obj = observedObjects[i];

					var oldVer = obj.snap,
						newVer = obj.now,
						id = obj.id;

					var changes = [];
					for(var prop in oldVer){
						if(!(prop in newVer)){
							var change = {};
							change.name = prop;
							change.target = newVer;
							change.oldVal = oldVer[prop];
							change.snap = oldVer;
							change.type = 'delete';
							
							changes.push(change);
						}
					}
					for(var prop in newVer){
						if(!(prop in oldVer)){
							var change = {};
							change.name = prop;
							change.target = newVer;
							change.newVal = newVer[prop];
							change.snap = oldVer;
							change.type = 'add';
							
							changes.push(change);
						}
					}
					if(changes.length>0){
						handler(changes);
					}
				}

				dirtyCheck();
			});
		}
		function clearObserve(obj){
			var oo = null;
			for(var i=observedObjects.length;i--;){
				oo = observedObjects[i];
				if(oo.id === obj.__im__oid)break;
			}
			if(i>-1){
				observedObjects.splice(i,1);
				if(isObject(oo)){
					clearObserve(oo);
				}
			}
		}
		function handler(changes,fromSetter){
			for(var i=changes.length;i--;){
				var change = changes[i];

				// console.log(change);

				var name = change.name;
				var target = change.target;
				var path = target.__im__propChain;//.concat();
		    	var comp = target.__im__comp;
		    	var old = change.oldVal;
		    	var v = change.newVal;
		    	var type = change.type;
		    	var snap = change.snap;

		    	if(type === 'add'){
		    		snap[name] = v;
		    		target.__im__innerProps[name] = v;
		    		if(isObject(v)){
		    			var pc = path.concat();
		    			pc.push(name);
		    			target.__im__innerProps[name] = observeData(pc,v,comp);
		    		}
		    		!function(name,target){
		    			Object.defineProperty(target,name,{
		    				get:function(){
		    					return getter.call(this,name)
		    				},
							set:function(v){
								setter.call(this,name,v)
							},
							enumerable:true,
							configurable:true
		    			});
		    		}(name,target);
		    		
		    	}else 
		    	if(type === 'delete'){
		    		var obj = snap[name];
		    		if(isObject(obj)){
		    			clearObserve(obj);
		    		}
		    		delete snap[name];
		    	}else if(!fromSetter){
		    		console.log('无效update')
		    		continue;
		    	}

		    	var changeObj = {object:target,name:name,pc:path,oldVal:old,newVal:v,comp:comp,type:type};
		    	ChangeHandler.handle(changeObj);
		    }
		}
		var observedObjects = [];//用于保存监控对象

		var RAF = (function(w){
		    return  w.requestAnimationFrame       || 
		            w.webkitRequestAnimationFrame ||
		            w.msRequestAnimationFrame     ||
		            w.mozRequestAnimationFrame    ||
		            w.oRequestAnimationFrame      ||
		            function(callback) {
		                return w.setTimeout(function() {
		                    callback(Date.now());
		                },16.7);
		            };
		})(self);

		Observer = {};
		Observer.observe = function(data,component){
			if(data && data.__im__propChain)return data;

			return observeData([],data,component);
		}

		dirtyCheck();
	}();
function pNode(type,tag,txtQ){
    this.type = type;//1 node 3 text
    this.tag = tag;
    this.txtQ = txtQ;
    this.children = [];
    this.attrNodes = {};
    this.slotMap = {};
}
function pNodeAttr(name,directive){
    this.value;
    this.name = name;
    this.directive = directive;
}

var vn_counter = 0;
/**
 * 虚拟节点
 */
function VNode(tag,attrNodes,directives){
    this.tag = tag;
    this.txt;
    this.children;
    this.vid = vn_counter++;
    this.attrNodes = attrNodes;
    this._directives = directives;
    this._comp;//组件
    this.dom;
    this._forScopeQ;
    this._slotMap;
}
VNode.prototype = {
    /**
     * 绑定事件到该节点
     */
    on:function(type,exp){
        var evMap = EVENT_MAP[type];
        if(!evMap){
            evMap = EVENT_MAP[type] = {};
        }
        var fn = false;
        if(isFunction(exp)){
            fn = true;
        }
        if(fn){
            evMap[this.vid] = [this,exp,this._cid,fn];
        }else{
            var forScopeStart = '',forScopeEnd = '';
            if(this._forScopeQ)
                for(var i=0;i<this._forScopeQ.length;i++){
                    forScopeStart += 'with(arguments['+(3+i)+']){';
                    forScopeEnd += '}';
                }
            evMap[this.vid] = [this,new Function('scope,$event,$vnode','with(scope){'+forScopeStart+exp+forScopeEnd+'}'),this._cid];
        }
    },
    setAttribute:function(k,v){
        this.attrNodes[k] = v;
        return this;
    },
    getAttribute:function(k){
        return this.attrNodes[k];
    }
};


/**
 * funcs for build VNode
 */
function createElement(comp,condition,tag,props,directives,children,html,forScope){
    if(!condition)return;

    var rs = new VNode(tag,props,directives);
    var fsq = null;
    if(forScope)
        fsq = rs._forScopeQ = [forScope];
    if (COMP_MAP[tag]) {
        rs._comp = true;
        var slotData = children[0];
        rs._slots = slotData[0];
        rs._slotMap = slotData[1];
        return rs;
    }
    if(html != null){
        //这里需要更新children
        var pair = parseHTML(html);
        var fn = compileVDOM('<'+tag+'>'+html+'</'+tag+'>',comp);
        var root;
        try{
            root = fn.call(comp,comp.state,createElement,createTemplate,createText,createElementList,doFilter);
        }catch(e){
            error('[x-html] compile error on '+e.message);
            return;
        }
        children = root.children || [];
    }
    
    if(children.length>0){
        rs.children = [];
        children.forEach(function(node){
            if(node){
                if(node instanceof Array){
                    node.forEach(function(c){
                        c.parent = rs;
                        rs.children.push(c);
                        if(fsq){
                            var cfsq = c._forScopeQ;
                            if(cfsq){
                                c._forScopeQ = fsq.concat(cfsq);
                            }else{
                                c._forScopeQ = fsq;
                            }
                        }
                    });
                }else{
                    node.parent = rs;
                    rs.children.push(node);
                    if(fsq){
                        var cfsq = node._forScopeQ;
                        if(cfsq){
                            node._forScopeQ = fsq.concat(cfsq);
                        }else{
                            node._forScopeQ = fsq;
                        }
                    }
                }//end if
            }//end if
        });
    }
    
    return rs;
}
function createTemplate(condition,children,forScope){
    if(!condition)return;

    var fsq = null;
    if(forScope)
        fsq = [forScope];
    var rs = [];
    if(children.length>0){
        children.forEach(function(node){
            if(node){
                if(node instanceof Array){
                    node.forEach(function(c){
                        rs.push(c);
                        if(fsq){
                            var cfsq = c._forScopeQ;
                            if(cfsq){
                                c._forScopeQ = fsq.concat(cfsq);
                            }else{
                                c._forScopeQ = fsq;
                            }
                        }
                    });
                }else{
                    rs.push(node);
                    if(fsq){
                        var cfsq = node._forScopeQ;
                        if(cfsq){
                            node._forScopeQ = fsq.concat(cfsq);
                        }else{
                            node._forScopeQ = fsq;
                        }
                    }
                }//end if
            }//end if
        });
    }
    
    return rs;
}
function createText(txt){
    var rs = new VNode();
    rs.txt = txt && txt.toString?txt.toString():txt;
    return rs;
}
function createElementList(ds,iterator,scope,k,v){
    var rs = [];
    ds.forEach(function(item,i){
        var forScope = {$index:i};
        
        if(k)forScope[k] = i;
        forScope[v] = item;
        var tmp = iterator.call(scope,forScope);
        if(tmp){
            if(isArray(tmp)){
                rs = rs.concat(tmp);
            }else{
                rs.push(tmp);
            }
        }
    });
    return rs;
}
function doFilter(v,filters){
    for(var i=0;i<filters.length;i++){
        var f = filters[i];
        var ins = FILTER_MAP[f[0]];
        var params = f[1];
        params.unshift(v);
        v = ins.apply(ins,params);
    }
    return v;
}
var VDOM_CACHE = [];
//解析属性名，如果是指令，返回指令name,参数
function isDirectiveVNode(attrName,comp){
    var rs = null;
    var params = null;
    var filter = null;
    if(REG_CMD.test(attrName)){
        var c = attrName.replace(CMD_PREFIX,'');
        var CPDI = c.indexOf(CMD_PARAM_DELIMITER);
        if(CPDI > -1)c = c.substring(0,CPDI);
        rs = c;

        var i = attrName.indexOf(CMD_PARAM_DELIMITER);
        if(i > -1){
            params = attrName.substr(i+1);
        }

        switch(c){
            case 'if':case 'for':case 'html':return c;
        }

        //如果有对应的处理器
        if(!DIRECT_MAP[c]){
            warn("指令 '"+c+"' 没有对应的处理器");
            return;
        }
    }else if(attrName[0] === EV_AB_PRIFX){
        rs = 'on';
        params = attrName.substr(1);
    }else if(attrName[0] === BIND_AB_PRIFX && !comp){
        rs = 'bind';
        params = attrName.substr(1);
    }

    if(params){
        var fi = params.indexOf(CMD_FILTER_DELIMITER);
        if(fi > -1){
            filter = params.substr(fi+1);
            params = params.substring(0,fi);
        }

        params = params.split(CMD_PARAM_DELIMITER);
    }

    return rs?[rs,params,filter]:rs;
}
//解析for语句：datasource，alias
//包括to和普通语法
function parseDirectFor(name,attrNode){
    if(name !== 'for')return false;

    var rs = null;//k,v,filters,ds1,ds2;
    var forExpStr = attrNode.exp[0];
    var filters = attrNode.exp[1];
    if(!forExpStr.match(/^([\s\S]*?)\s+as\s+([\s\S]*?)$/)){
        //each语法错误
        error('invalid each expression : '+forExpStr);
        return;
    }
    var alias = RegExp.$2;
    var kv = alias.split(',');
    var k = kv.length>1?kv[0]:null;
    var v = kv.length>1?kv[1]:kv[0];
    var ds = RegExp.$1;
    if(ds.match(/^([\s\S]*?)\s+to\s+([\s\S]*?)$/)){ 
        rs = [k,v,filters,RegExp.$1,RegExp.$2];
    }else{
        rs = [k,v,filters,ds];
    }
    return rs;
}
function parseDirectIf(name,attrNode){
    if(name !== 'if')return false;

    return attrNode.exp[0];
}
function parseDirectHTML(name,attrNode){
    if(name !== 'html')return false;

    return attrNode.exp[0];
}
function replaceGtLt(str){
    return str.replace(/&gt;/img,'>').replace(/&lt;/img,'<');
}

//https://www.w3.org/TR/html5/syntax.html#void-elements
var VOIDELS = ['br','hr','img','input','link','meta','area','base','col','embed','keygen','param','source','track','wbr'];
function parseHTML(str){
    var op = null;
    var strQueue = '';
    var lastNode = null;
    var lastAttrNode = null;
    var delimiter = null;
    var escape = false;
    var roots = [];
    var nodeStack = [];
    var startTagLen = EXP_START_TAG.length;
    var endTagLen = EXP_END_TAG.length;
    var inExp = false;//在表达式内部
    var delimiterInExp = null;
    var escapeInExp = null;
    var expStartPoint = 0;
    var expEndPoint = 0;
    var filterStartTagLen = FILTER_EXP_START_TAG.length;
    var filterStartEntityLen = FILTER_EXP_START_TAG_ENTITY.length;
    var filterStartPoint = 0;
    var lastFilter = '';
    var lastOp = null;
    var lastFilterList = [];
    var lastFilterParam = '';
    var lastFilterParamList = [];
    var textQ = [];
    var compNode;
    var slotNode;
    var slotList = [];

    for(var i=0;i<=str.length;i++){
        var c = str[i];

        if(!op && c==='<'){//开始解析新节点
            op = 'n';
            continue;
        }else if(!op){
            op = 't';
        }

        if(op==='a' || op==='t' || op==='efp'){
            if(strQueue.length>=startTagLen && !inExp){
                var expStart = strQueue.substr(strQueue.length-startTagLen);
                if(expStart == EXP_START_TAG){
                    var sp = expEndPoint===0?expEndPoint:expEndPoint+endTagLen;
                    textQ.push(strQueue.substr(sp).replace(EXP_START_TAG,''));
                    inExp = true;
                    expStartPoint = strQueue.length;
                    if(op==='a'){
                        var n = lastAttrNode.name;
                        error("属性'"+n+"'不能包含表达式，动态内容请使用 'x-bind:"+n+" / ."+n+"'替代");
                        return;
                    }
                }
            }
            escape = false;
            if(c === '\\'){
                escape = true;
            }
            if(inExp && (c === '\'' || c === '"')){
                if(!delimiterInExp)delimiterInExp = c;
                else{
                    if(c === delimiterInExp && !escape){
                        delimiterInExp = null;
                    }
                }
            }
        }

        switch(op){
            case 'n':
                if(c===' '||c==='\n'|| c==='\t' || c==='>'){
                    if(!strQueue)break;//<  div 这种场景，过滤前面的空格
                    if(strQueue.indexOf('<')>-1){
                        error("unexpected identifier '<' in tagName '"+strQueue+"'");
                        return;
                    }

                    //创建VNode
                    var node = new pNode(1,strQueue);
                    lastNode = nodeStack[nodeStack.length-1];
                    //handle slot
                    if(COMP_MAP[strQueue]){
                        compNode = node;
                    }
                    if(strQueue === SLOT){
                        slotNode = [lastNode,node];
                        slotList.push(slotNode);
                    }

                    if(lastNode){
                        lastNode.children.push(node);
                    }
                    if(VOIDELS.indexOf(strQueue)>-1){
                        node.isVoid = true;
                    }
                    if(nodeStack.length<1){
                        roots.push(node);
                    }
                    lastNode = node;
                    if(!node.isVoid)
                        nodeStack.push(lastNode);

                    

                    if(c==='>'){
                        if(node.isVoid){
                            lastNode = nodeStack[nodeStack.length-1];
                        }
                        op = 't';
                    }else{
                        op = 'a';
                    }
                    
                    strQueue = '';
                    break;
                }
                if(c === '\/'){//终结节点，这里要判断是否和当前解析的元素节点相同
                    //如果不做非法语法验证，只需要跳过即可
                    op = 'e';
                    break;
                }
                strQueue += c;break;
            case 'e':
                if(c===' '|| c==='\t')break;
                if(c === '>'){
                    nodeStack.pop();
                    lastNode = nodeStack[nodeStack.length-1];

                    if(compNode && compNode.tag === strQueue){
                        compNode = null;
                    }
                    if(strQueue === SLOT){
                        slotNode = null;
                    }
                    
                    op = 't';
                    strQueue = '';
                    break;
                }
                strQueue += c;break;
            case 'a':
                if(!delimiter && strQueue.length<1 && (c === ' '|| c==='\t'))break;
                if(!delimiter && c === '>'){//结束节点解析
                    //check component or directive
                    // if(ComponentFactory.hasTypeOf(lastNode.tag)){
                    //     node.comp = lastNode.tag;
                    // }

                    if(lastNode.isVoid){
                        lastNode = nodeStack[nodeStack.length-1];
                    }
                    op = 't';
                    break;
                }
                if(!lastAttrNode){//解析属性名
                    var noValueAttr = strQueue.length>0 && (c === ' '|| c==='\t');
                    if(c === '=' || noValueAttr){
                        //创建VAttrNode
                        var aName = strQueue.trim();
                        lastAttrNode = new pNodeAttr(aName,isDirectiveVNode(aName,compNode));
                        lastNode.attrNodes[aName] = lastAttrNode;

                        strQueue = '';

                        if(noValueAttr){
                            lastAttrNode = null;
                        }
                        break;
                    }
                    strQueue += c;break;
                }else{
                    if(c === '\'' || c === '"'){
                        if(!delimiter){
                            delimiter = c;

                            if(lastAttrNode.directive){
                                //进入表达式解析
                                inExp = true;
                                expStartPoint = 0;
                            }

                            break;
                        }else{
                            if(c === delimiter && !escape){
                                lastAttrNode.value = strQueue;
                                if(lastAttrNode.name === SLOT){
                                    compNode.slotMap[strQueue] = lastNode;
                                }

                                if(slotNode && lastAttrNode.name === 'name'){
                                    slotNode.push(strQueue);
                                }

                                //parse for
                                if(lastAttrNode.directive){
                                    var tmp = null;
                                    var dName = lastAttrNode.directive;
                                    if(dName === 'for' || dName === 'if' || dName === 'html'){
                                        if(tmp = parseDirectFor(dName,lastAttrNode)){
                                            lastNode.for = tmp;
                                        }
                                        if(tmp = parseDirectIf(dName,lastAttrNode)){
                                            lastNode.if = tmp;
                                        }
                                        if(tmp = parseDirectHTML(dName,lastAttrNode)){
                                            lastNode.html = tmp;
                                        }
                                        lastNode.attrNodes[lastAttrNode.name] = null;
                                        delete lastNode.attrNodes[lastAttrNode.name];
                                    }
                                }

                                lastAttrNode = null;
                                delimiter = null;
                                strQueue = '';
                                break;
                            }
                        }
                    }
                    strQueue += c;break;
                }
                break;
            case 't':
                if(!inExp && (c === '<' || !c)){
                    var tmp = strQueue.replace(/^\s*|\s*$/,'');
                    if(tmp){
                        var txt = strQueue;
                        if(textQ.length>0)txt = txt.substr(expEndPoint+endTagLen,strQueue.length-startTagLen);
                        if(txt){
                            textQ.push(txt);
                        }
                        var tn = new pNode(3,null,textQ);
                        textQ = [];
                        if(lastNode){
                            lastNode.children.push(tn);
                        }
                        expEndPoint = 0;
                    }
                    op = 'n';
                    strQueue = '';
                    break;
                }
                strQueue += c;
                break;
            case 'ef':
                if(c === ' '|| c==='\t')break;
                var append = true;
                if(c===FILTER_EXP_PARAM_SPLITTER){
                    // => xxx:
                    // => xxx:yy: 
                    // 这里只会出现第一种情况，第二种需要在efp中处理
                    lastFilter = {name:lastFilter,param:[]};
                    lastFilterList.push(lastFilter);
                    // lastFilter = '';
                    op='efp';
                    append = false;
                }else if(c===FILTER_EXP_SPLITTER){
                    // => xxx |
                    // => xxx:yy |
                    // 这里只会出现第一种情况，第二种需要在efp中处理
                    lastFilter = {name:lastFilter,param:[]};
                    lastFilterList.push(lastFilter);
                    lastFilter = '';
                    append = false;
                }
                
                strQueue += c;
                if(append)lastFilter += c;
                break;
            case 'efp':
                var append = true;
                if(!delimiterInExp){
                    if(c === ' '|| c==='\t')break;
                    if(lastFilter && (c===FILTER_EXP_PARAM_SPLITTER ||c===FILTER_EXP_SPLITTER)){
                        lastFilter.param.push(lastFilterParam);
                        lastFilterParam = '';
                        append = false;
                        if(c===FILTER_EXP_SPLITTER){
                            op = 'ef';
                            lastFilter = '';
                        }
                    }
                }

                if(append)lastFilterParam += c;
                strQueue += c;
        }//end switch

        if((op==='a' || op==='t' || op==='ef' || op==='efp') && inExp){
            var filterStart = strQueue.substr(strQueue.length-filterStartTagLen);
            var filterEntityStart = strQueue.substr(strQueue.length-filterStartEntityLen);
            if((filterStart===FILTER_EXP_START_TAG || filterEntityStart===FILTER_EXP_START_TAG_ENTITY) 
                && op!=='ef' && !delimiterInExp){
                // inFilter = true;
                lastOp = op;
                op = 'ef';
                if(filterStart===FILTER_EXP_START_TAG){
                    filterStartPoint = strQueue.length - filterStartTagLen;
                }else{
                    filterStartPoint = strQueue.length - filterStartEntityLen;
                }
                
            }else if(inExp){
                var expEnd = strQueue.substr(strQueue.length-endTagLen);
                var doEnd = expEnd===EXP_END_TAG;//大括号表达式结束
                var isDi = false;
                //对于指令表达式结束
                if(lastAttrNode && lastAttrNode.directive && delimiter 
                    && (!delimiterInExp && !escape) 
                    && str[i+1]==delimiter){
                    isDi = doEnd = true;
                }
                if(doEnd){
                    switch(op){
                        case 't':
                            if(delimiterInExp)continue;
                            break;
                        case 'ef':
                            if(lastFilter){
                                var tmp = new RegExp(EXP_END_TAG+'$');
                                lastFilter = lastFilter.replace(tmp,'');
                                lastFilter = {name:lastFilter,param:[]};
                                lastFilterList.push(lastFilter);
                            }
                            break;
                        case 'efp':
                            if(lastFilterParam){
                                var tmp = new RegExp(EXP_END_TAG+'$');
                                lastFilterParam = lastFilterParam.replace(tmp,'');                            

                                lastFilter.param.push(lastFilterParam);
                            }
                            break;
                    }
                    inExp = false;
                    var withoutFilterStr = strQueue.substring(expStartPoint,filterStartPoint||(strQueue.length-endTagLen));
                    expEndPoint = strQueue.length-endTagLen;
                    
                    if(isDi){
                        withoutFilterStr = strQueue.substring(0,filterStartPoint||strQueue.length);
                    }
                    
                    filterStartPoint = 0;
                    if(lastOp==='t' || op==='t'){
                        textQ.push(['('+replaceGtLt(withoutFilterStr)+')',lastFilterList]);
                    }else if(lastOp==='a' || op==='a'){
                        lastAttrNode.exp = [withoutFilterStr,lastFilterList];
                        expEndPoint = 0;
                    }
                    
                    
                    lastFilter = '';
                    lastFilterList = [];
                    if(lastOp){
                        lastFilter = '';
                        lastFilterParam = '';
                        op = lastOp;
                        lastOp = null;
                    }
                }
            }
            
        }//end if
    }// end for

    return [roots,slotList];
}
function buildVDOMStr(pm){
    var str = buildEvalStr(pm);
    return 'with(scope){return '+str+'}';
}
function buildEvalStr(pm){
    var str = '';
    if(pm.type === 1){
        var children = '';
        if(COMP_MAP[pm.tag]){
            children = JSON.stringify([pm.children,pm.slotMap]);
        }else{
            for(var i=0;i<pm.children.length;i++){
                children += ','+buildEvalStr(pm.children[i]);
            }
            if(children.length>0)children = children.substr(1);
        }            
        var pair = buildAttrs(pm.attrNodes);
        var attrStr = pair[0];
        var dirStr = pair[1];
        var ifStr = pm.if || 'true';
        var innerHTML = pm.html || 'null';
        var nodeStr = '_ce(this,'+ifStr+',"'+pm.tag+'",'+attrStr+','+dirStr+',['+children+'],'+innerHTML;
        if(pm.tag == 'template'){
            nodeStr = '_tmp('+ifStr+',['+children+']';
        }
        if(pm.for){
            var k = (pm.for[0]||'').trim();
            var v = pm.for[1].trim();
            var filter = pm.for[2];
            var ds1 = pm.for[3];
            var ds2 = pm.for[4];
            var dsStr = ds1;
            if(ds2){
                ds1 = ds1.replace(/(this[.a-z_$0-9]+)?[_$a-z][_$a-z0-9]*\(/img,function(a){
                    if(a.indexOf('this')===0)return a;
                    return 'this.'+a;
                });
                ds2 = ds2.replace(/(this[.a-z_$0-9]+)?[_$a-z][_$a-z0-9]*\(/img,function(a){
                    if(a.indexOf('this')===0)return a;
                    return 'this.'+a;
                });
                dsStr = "(function(){var rs=[];for(var i="+ds1+";i<="+ds2+";i++)rs.push(i);return rs;}).call(this)"
            }
            if(filter){
                dsStr = "_fi("+dsStr+","+buildFilterStr(filter)+")";
            }
            str += '_li('+dsStr+',function(forScope){ with(forScope){return '+nodeStr+',forScope)}},this,"'+k+'","'+v+'")';
        }else{
            str += nodeStr+')';
        }
    }else{
        var tmp = buildTxtStr(pm.txtQ);
        str += '_ct('+tmp+')';
    }

    return str;
}
function buildAttrs(map){
    var rs = {};
    var dirStr = '';
    for(var k in map){
        var attr = map[k];
        if(attr.directive){
            var exp = attr.value.replace(/(this[.a-z_$0-9]+)?[_$a-z][_$a-z0-9]*\(/img,function(a){
                if(a.indexOf('this')===0)return a;
                return 'this.'+a;
            });
            dirStr += ",['"+k+"',"+JSON.stringify(attr.directive)+","+(attr.directive[0] === 'on'?JSON.stringify(exp):exp)+","+JSON.stringify(exp)+"]";
        }else{
            rs[k] = attr.value;
        }
    }//end for
    return [JSON.stringify(rs),'['+dirStr.substr(1)+']'];
}
function buildTxtStr(q){
    var rs = '';
    q.forEach(function(item){
        if(item instanceof Array){
            var exp = item[0];
            var filter = item[1];
            if(filter.length>0){
                rs += "+_fi("+exp+","+buildFilterStr(filter)+")";
            }else{
                rs += "+"+exp;
            }
        }else if(item){
            rs += "+"+JSON.stringify(item);
        }
    });
    rs = rs.replace(/\n/mg,'');
    if(rs.length>0)rs = rs.substr(1);
    return rs;
}
function buildFilterStr(filters){
    var rs = '';
    filters.forEach(function(f){
        var tmp = '["'+f.name+'",['+f.param.toString()+']]';
        rs += ','+tmp;
    });
    return '['+rs.substr(1)+']';
}
function compileVDOM(str,comp){
    if(VDOM_CACHE[str] && !comp.__slots && !comp.__slotMap)return VDOM_CACHE[str];

    var pair = parseHTML(str);
    var roots = pair[0];
    if(roots.length>1){
        warn('组件只能有唯一的顶级节点');
    }
    var rs = roots[0];
    if(rs.type != 1 || rs.tag == 'template' || rs.tag == 'slot' || rs.for){
        error('组件顶级标签不能是template / slot');
        return;
    }
    //doslot
    doSlot(pair[1],comp.__slots,comp.__slotMap);

    rs = buildVDOMStr(rs);
    // console.log(rs);
    rs = new Function('scope,_ce,_tmp,_ct,_li,_fi',rs);
    VDOM_CACHE[str] = rs;
    return rs;
}
/**
 * get vdom tree for component
 */
function buildVDOMTree(comp){
    var fn = compileVDOM(comp.compiledTmp,comp);

    var root = null;
    try{
        root = fn.call(comp,comp.state,createElement,createTemplate,createText,createElementList,doFilter);
    }catch(e){
        error('compile error on '+e.message);
    }
    return root;
}
var forScopeQ = null;
function compareVDOM(newVNode,oldVNode,comp){
    forScopeQ = {};
    if(isSameVNode(newVNode,oldVNode)){
        compareSame(newVNode,oldVNode,comp);
    }else{
        //remove old,insert new
        insertBefore(newVNode,oldVNode,oldVNode.parent?oldVNode.parent.children:null,oldVNode.parent,comp);
        removeVNode(oldVNode);
    }
    return forScopeQ;
}
function compareSame(newVNode,oldVNode,comp){
    if(newVNode._comp){
        forScopeQ[oldVNode._cid] = newVNode._forScopeQ;
        return;
    }

    if(newVNode.tag){
        var rebindDis = false;
        //先比较指令列表
        for(var i=newVNode._directives.length;i--;){
            var ndi = newVNode._directives[i];
            var odi = oldVNode._directives[i];
            if(ndi[2] !== odi[2]){
                rebindDis = true;
                break;
            }
        }
        if(rebindDis){
            newVNode._directives.forEach(function(di){
                var dName = di[1][0];
                if(dName === 'on')return;
                var d = DIRECT_MAP[dName];
                if(!d)return;
                
                var params = di[1][1];
                var v = di[2];
                var exp = di[3];
                d.onBind && d.onBind(newVNode,{value:v,args:params,exp:exp});
            });
        }

        //for unstated change like x-html
        updateAttr(newVNode,oldVNode);

        //update events forscope
        if(oldVNode._forScopeQ){
            oldVNode._forScopeQ = newVNode._forScopeQ;
        }
    }else{
        if(newVNode.txt !== oldVNode.txt){
            updateTxt(newVNode,oldVNode);
        }
    }

    if(newVNode.children && oldVNode.children){
        compareChildren(newVNode.children,oldVNode.children,oldVNode,comp);
    }else if(newVNode.children){
        //插入新的整个子树
        insertChildren(oldVNode,newVNode.children,comp);
    }else if(oldVNode.children && oldVNode.children.length>0){
        //删除旧的整个子树
        removeVNode(oldVNode.children);
    }
}

function compareChildren(nc,oc,op,comp){
    var osp = 0,oep = oc.length-1,
        nsp = 0,nep = nc.length-1,
        os = oc[0],oe = oc[oep],
        ns = nc[0],ne = nc[nep];

    while(osp <= oep && nsp <= nep){
        if(isSameVNode(ns,os)){
            compareSame(ns,os,comp);
            os = oc[++osp],
            ns = nc[++nsp];
            continue;
        }else if(isSameVNode(ne,oe)){
            compareSame(ne,oe,comp);
            oe = oc[--oep],
            ne = nc[--nep];
            continue;
        }else if(isSameVNode(ne,os)){
            insertBefore(os,next(oe),oc,op,comp);
            os = oc[osp];oep--;
            ne = nc[--nep];
            continue;
        }else if(isSameVNode(ns,oe)){
            insertBefore(oe,os,oc,op,comp);
            oe = oc[oep];osp++;
            ns = nc[++nsp];
            continue;
        }else{
            if(ns.getAttribute('xid')){
                //处理id重用
            }else{
                //插入ov之前，并删除ov
                insertBefore(ns,os,oc,op,comp);
                removeVNode(os);
                nsp++;
            }
        }
    }
    //在osp位置，插入剩余的newlist，删除剩余的oldlist
    if(osp <= oep && oep>0){
        var toDelList = oc.splice(osp,oep-osp+1);
        if(toDelList.length>0){
            removeVNode(toDelList);
        }
    }
    if(nsp <= nep){
        var toAddList = nsp==nep?[nc[nsp]]:nc.splice(nsp,nep-nsp+1);
        if(toAddList.length>0){
            insertBefore(toAddList,oc[osp],oc,op,comp);
        }
    }
}

function insertBefore(nv,target,list,targetParent,comp){
    if(list){
        //处理vdom
        if(nv.dom){//删除ov
            var i = list.indexOf(nv);
            if(i>-1)list.splice(i,1);
        }
        var p = targetParent;
        if(target){
            i = list.indexOf(target);
            p = p || target.parent;
            if(isArray(nv)){
                for(var l=nv.length;l--;){
                    nv[l].parent = p;
                }
                var args = [i,0].concat(nv);
                list.splice.apply(list,args);
            }else{
                nv.parent = p;
                list.splice(i,0,nv);
            }//end if
        }else{
            if(isArray(nv)){
                nv.forEach(function(n){
                    list.push(n);
                    n.parent = p;
                });
            }else{
                nv.parent = p;
                list.push(nv);
            }//end if
        }
    }
    //处理dom
    var dom = nv.dom;
    var compAry = [];
    if(!dom){
        if(isArray(nv)){
            var fragment = document.createDocumentFragment();
            for(var i=0;i<nv.length;i++){
                var vn = nv[i];
                var tmp = buildOffscreenDOM(vn,comp);
                //bind vdom
                if(vn._comp){
                    parseComponent(vn._comp);
                    compAry.push(vn._comp);
                }
                fragment.appendChild(tmp);
            }
            dom = fragment;
        }else{
            dom = buildOffscreenDOM(nv,comp);
        }
    }else{
        dom.parentNode.removeChild(dom);
    }
    // if(dom.parentNode)dom.parentNode.removeChild(dom);
    if(target){
        var tdom = target.dom;
        tdom.parentNode.insertBefore(dom,tdom);
    }else{
        targetParent.dom.appendChild(dom);
    }
    
    //comp
    for(var i=0;i<compAry.length;i++){
        var tmp = compAry[i];
        mountComponent(tmp,targetParent);
    }
}
function next(nv){
    var p = nv.parent;
    var i = p.children.indexOf(nv);
    return p.children[i+1];
}
function removeVNode(vnodes){
    if(!isArray(vnodes))vnodes = [vnodes];
    var parent = vnodes[0].parent;
    for(var i=vnodes.length;i--;){
        var vnode = vnodes[i];
        var k = parent.children.indexOf(vnode);
        if(k>-1){
            parent.children.splice(k,1);
        }
        var p = vnode.dom.parentNode;
        p && p.removeChild(vnode.dom);

        //todo...   release other resource
        if(impex._cs[vnode._cid] && vnode.getAttribute(DOM_COMP_ATTR)){
            impex._cs[vnode._cid].destroy();
        }
    }
}
function insertChildren(parent,children,comp){
    parent.children = children;
    var fragment = document.createDocumentFragment();
    var compAry = [];
    for(var i=0;i<children.length;i++){
        var vn = children[i];
        var dom = buildOffscreenDOM(vn,comp);
        //bind vdom
        if(vn._comp){
            parseComponent(vn._comp);
            compAry.push(vn._comp);
            // mountComponent(vn._comp);
        }
        fragment.appendChild(dom);
    }
    parent.dom.appendChild(fragment);

    for(var i=0;i<compAry.length;i++){
        var tmp = compAry[i];
        mountComponent(tmp);
    }
}
function isSameVNode(nv,ov){
    if(nv._comp && ov.getAttribute(DOM_COMP_ATTR)==nv.tag)return true;
    return ov.tag === nv.tag;
}
function updateTxt(nv,ov){
    ov.txt = nv.txt;
    var dom = ov.dom;
    dom.textContent = nv.txt;
}
function updateAttr(nv,ov){
    //比较节点属性
    var nvas = nv.attrNodes;
    var ovas = ov.attrNodes;
    var nvasKs = Object.keys(nvas);
    var ovasKs = Object.keys(ovas);
    var odom = ov.dom;
    for(var i=nvasKs.length;i--;){
        var k = nvasKs[i];
        var index = ovasKs.indexOf(k);
        if(index<0){
            odom.setAttribute(k,nvas[k]);
        }else{
            if(nvas[k] != ovas[k])
                odom.setAttribute(k,nvas[k]);
            ovasKs.splice(index,1);
        }
    }
    for(var i=ovasKs.length;i--;){
        if(ovasKs[i] === DOM_COMP_ATTR)continue;
        odom.removeAttribute(ovasKs[i]);
    }

    //update new attrs
    var comp_attr = ov.attrNodes[DOM_COMP_ATTR];
    ov.attrNodes = nv.attrNodes;
    if(comp_attr)ov.attrNodes[DOM_COMP_ATTR] = comp_attr;
    //update new directive exp value
    ov._directives = nv._directives;
    ov._directives.forEach(function(dir){
        if(isArray(dir[2]) || isObject(dir[2])){
            dir[2] = JSON.parse(JSON.stringify(dir[2]));
        }
    });
}



/**
 * for DOM event delegation，support mouseEvent , touchEvent and pointerEvent
 */
function dispatch(type,e) {
    var p = e.target;
    do{
        var uid = p._vid;
        if(uid === undefined)continue;
        var evMap = EVENT_MAP[type];
        if(!evMap)continue;
        var tmp = evMap[uid];
        if(!tmp)continue;

        var vnode = tmp[0];
        var fn = tmp[1];
        var cid = tmp[2];
        var isFn = tmp[3];
        var comp = impex._cs[cid];
        if(isFn){
            fn.call(comp,e,vnode);
        }else{
            var args = [comp.state,e,vnode];
            if(vnode._forScopeQ)
                for(var i=0;i<vnode._forScopeQ.length;i++){
                    args.push(vnode._forScopeQ[i]);
                }
            fn.apply(comp,args);
        }
        
    }while((p = p.parentNode) && p.tagName != 'BODY');
}
//touch/mouse/pointer events
var userAgent = self.navigator.userAgent.toLowerCase();
var isAndroid = userAgent.indexOf('android')>0?true:false;
var isIphone = userAgent.indexOf('iphone')>0?true:false;
var isIpad = userAgent.indexOf('ipad')>0?true:false;
var isWphone = userAgent.indexOf('windows phone')>0?true:false;
var isMobile = isIphone || isIpad || isAndroid || isWphone;
if(isMobile){
    var FLING_INTERVAL = 200;
    var lastTapTime = 0;
    var timer;
    var hasMoved = false;
    var canceled = false;
    var fling_data;
    ///////////////////// touch events /////////////////////
    document.addEventListener('touchstart',doStart,true);
    document.addEventListener('touchmove',doMove,true);
    document.addEventListener('touchend',doEnd,true);
    document.addEventListener('touchcancel',doCancel,true);
    function doStart(e){
        dispatch('touchstart',e);
        dispatch('pointerdown',e);

        //start timer
        timer = setTimeout(function(){
            dispatch('press',e);
        },800);

        hasMoved = false;
        canceled = false;

        //handle fling
        var touch = e.touches[0];
        fling_data = {
            x:touch.clientX,
            y:touch.clientY,
            t:Date.now()
        };
    }
    function doMove(e){
        clearTimeout(timer);

        dispatch('touchmove',e);
        dispatch('pointermove',e);

        hasMoved = true;
    }
    function doCancel(e){
        clearTimeout(timer);

        canceled = true;
        dispatch('touchcancel',e);
        dispatch('pointercancel',e);
    }
    function doEnd(e){
        clearTimeout(timer);
        
        dispatch('touchend',e);
        dispatch('pointerup',e);

        if(canceled)return;

        if(!hasMoved){
            dispatch('tap',e);

            if(Date.now() - lastTapTime < 300){
                dispatch('dbltap',e);
            }

            lastTapTime = Date.now();
        }else{
            var touch = e.changedTouches[0];
            var dx = touch.clientX,
                dy = touch.clientY;

            var data = fling_data;
            var sx = data.x,
                sy = data.y,
                st = data.t;

            var long = Date.now() - st;
            var s = Math.sqrt((dx-sx)*(dx-sx)+(dy-sy)*(dy-sy)) >> 0;
            //时间小于interval并且位移大于20px才触发fling
            if(long <= FLING_INTERVAL && s > 20){
                var r = Math.atan2(dy-sy,dx-sx);

                var extra = {
                    slope:r,
                    interval:long,
                    distance:s
                }

                dispatch('fling',e,extra);
            }
        }
    }
}else{
    ///////////////////// 鼠标事件分派器 /////////////////////
    document.addEventListener('mousedown',doMousedown,true);
    document.addEventListener('mousemove',doMousemove,true);
    document.addEventListener('mouseup',doMouseup,true);
    window.addEventListener('blur',doMouseCancel,true);
    var type = self.onmousewheel == null?'mousewheel':'DOMMouseScroll';
    document.addEventListener(type,doMousewheel,true);

    document.addEventListener('mouseout',doMouseout,true);

    var inited = true;
    var lastClickTime = 0;
    var timer;
        
    function doMousedown(e){
        dispatch('mousedown',e);
        dispatch('pointerdown',e);

        //start timer
        timer = setTimeout(function(){
            dispatch('press',e);
        },800);
    }
    function doMousemove(e){
        clearTimeout(timer);

        dispatch('mousemove',e);
        dispatch('pointermove',e);
    }
    function doMouseup(e){
        clearTimeout(timer);

        dispatch('mouseup',e);
        dispatch('pointerup',e);

        if(e.button === 0){
            dispatch('click',e);
            dispatch('tap',e);
            if(Date.now() - lastClickTime < 300){
                dispatch('dblclick',e);
                dispatch('dbltap',e);
            }

            lastClickTime = Date.now();
        }
    }
    function doMouseCancel(e){
        clearTimeout(timer);

        dispatch('pointercancel',e);                
    }
    function doMouseout(e){
        dispatch('mouseout',e);
    }
    function doMousewheel(e){
        dispatch('mousewheel',e);
    }
}

//model events
document.addEventListener('input',function(e){
    dispatch('input',e);
},true);
document.addEventListener('change',function(e){
    dispatch('change',e);
},true);

//keyboard events
document.addEventListener('keydown',function(e){
    dispatch('keydown',e);
},true);
document.addEventListener('keypress',function(e){
    dispatch('keypress',e);
},true);
document.addEventListener('keyup',function(e){
    dispatch('keyup',e);
},true);

//focus events
document.addEventListener('focus',function(e){
    dispatch('focus',e);
},true);
document.addEventListener('blur',function(e){
    dispatch('blur',e);
},true);

//mousewheel
var mousewheel = self.onwheel==null?'wheel':'mousewheel';
document.addEventListener(mousewheel,function(e){
    dispatch('wheel',e);
},true);

//scroll
document.addEventListener('scroll',function(e){
    dispatch('scroll',e);
},true);
/**
 * 变更处理器，处理所有变量变更，并触发渲染
 */

var ChangeHandler = new function() {

	function mergeChange(change){
		for(var i=changeQ.length;i--;){
			var c = changeQ[i];
			if(c.object.__im__oid === change.object.__im__oid && c.name === change.name)break;
		}
		if(i > -1)
			changeQ.splice(i,1,change);
		else{
			changeQ.push(change);
		}
	}

	var combineChange = false;
	var changeQ = [];
	var changeMap = {};

	this.handle = function (change){
		if(combineChange){
			mergeChange(change);
		}else{
			changeQ = [];
			changeMap = {};
			combineChange = true;
			changeQ.push(change);
			setTimeout(function(){
				combineChange = false;

				changeQ.forEach(function(change){
					var comp = change.comp;

					var newVal = change.newVal;
					var oldVal = change.oldVal;
					var pc = change.pc;
					var type = change.type;
					var name = change.name;
					var object = change.object;
					
					handlePath(newVal,oldVal,comp,type,name,object,pc);
				});//end for
				var tmp = changeMap;
				for(var k in tmp){
					updateComponent(tmp[k].comp,tmp[k].changes);
				}
			},20);
		}
	}
	
	function handlePath(newVal,oldVal,comp,type,name,object,pc){
        var chains = [];
    	chains = pc.concat();
		if(!isArray(object))
        	chains.push(name);
        
        if(!comp)return;

        if(!changeMap[comp._uid]){
        	changeMap[comp._uid] = {
        		changes:[],
        		comp:comp
        	};
        }
        var c = new Change(name,newVal,oldVal,chains,type,object);
        changeMap[comp._uid].changes.push(c);
	}
}

/**
 * 变更信息
 */
function Change(name,newVal,oldVal,path,type,object){
	this.name = name;
	this.newVal = newVal;
	this.oldVal = oldVal;
	this.path = path;
	this.type = type;
	this.object = object;
}
/**
 * @classdesc 组件类，包含视图、模型、控制器，表现为一个自定义标签。同内置标签样，
 * 组件也可以有属性。
 * <br/>
 * 组件可以设置事件或者修改视图样式等<br/>
 * 组件实例为组件视图提供了数据和控制
 * 组件可以包含组件，所以子组件视图中的表达式可以访问到父组件模型中的值
 * <p>
 * 	组件生命周期
 * 	<ul>
 * 		<li>onCreate：当组件被创建时，该事件被触发，系统会把指定的服务注入到参数中</li>
 * 		<li>onPropChange：当参数要绑定到组件时，该事件被触发，可以手动clone参数或者传递引用</li>
 * 		<li>onUpdate: 当state中任意属性变更时触发。</li>
 * 		<li>onInit：当组件初始化时，该事件被触发，系统会扫描组件中的所有表达式并建立数据模型</li>
 * 		<li>onMount：当组件被挂载到组件树中时，该事件被触发，此时组件已经完成数据构建和绑定，DOM可用</li>
 * 		<li>onUnmount：当组件被卸载时，该事件被触发</li>
 * 		<li>onDestroy: 当组件被销毁时，该事件被触发</li>
 * 	</ul>
 * </p>
 * 
 * @class 
 */
function Component (el) {
	this._uid = 'C_' + im_counter++;

	/**
	 * 对顶级元素的引用
	 * @type {HTMLElement}
	 */
	this.el = el;
	/**
	 * 对子组件/dom的引用
	 * @type {Object}
	 */
	this.refs = {};
	/**
	 * 用于指定属性的类型，如果类型不符会报错
	 * @type {Object}
	 */
	this.propTypes = null;
	/**
	 * 组件名，在创建时由系统自动注入
	 */
	this.name;
	/**
	 * 对父组件的引用
	 * @type {Component}
	 */
	this.parent;
	/**
	 * 子组件列表
	 * @type {Array}
	 */
	this.children = [];
	//watchs
	this.__watchMap = {};
	this.__watchFn;
	this.__watchOldVal;
	this.__watchPaths = [];
	//syncs
	this.__syncFn = {};
	this.__syncOldVal = {};
	this.__syncFnForScope = {};

	/**
	 * 组件模版，用于生成组件视图
	 * @type {string}
	 */
	this.template;

	//组件url
	this.__url;
	/**
	 * 组件数据
	 * @type {Object}
	 */
	this.state = {};

	impex._cs[this._uid] = this;
};
Component.prototype = {
	/**
	 * 设置组件状态值
	 * @param {String} path 状态路径
	 * @param {Object} v  
	 */
	setState:function(path,v){
		v = JSON.stringify(v);
		var str = 'with(scope){'+path+'='+v+'}';
		var fn = new Function('scope',str);
		fn(this.state);
	},
	/**
	 * 监控当前组件中的模型属性变化，如果发生变化，会触发回调
	 * @param  {String} path 属性路径，比如a.b.c
	 * @param  {Function} cbk      回调函数，[object,name,变动类型add/delete/update,新值，旧值]
	 */
	watch:function(path,cbk){
		this.__watchPaths.push(path);
		var str = '';
		for(var i=this.__watchPaths.length;i--;){
			var p = this.__watchPaths[i];
			str += ','+JSON.stringify(p)+':'+p;
		}
		str = str.substr(1);
		var fn = this.__watchFn = new Function('scope','with(scope){return {'+str+'}}');
		this.__watchOldVal = fn(this.state);
		this.__watchMap[path] = cbk;

		return this;
	},
	/**
	 * 销毁组件，会销毁组件模型，以及对应视图，以及子组件的模型和视图
	 */
	destroy:function(){
		this.onDestroy && this.onDestroy();

		if(this.parent){
			this.parent.__syncFn[this._uid] = null;
			this.parent.__syncOldVal[this._uid] = null;
			this.parent.__syncFnForScope[this._uid] = null;
			delete this.parent.__syncFn[this._uid];
			delete this.parent.__syncOldVal[this._uid];
			delete this.parent.__syncFnForScope[this._uid];
			var index = this.parent.children.indexOf(this);
			if(index > -1){
				this.parent.children.splice(index,1);
			}
			this.parent = null;
		}

		while(this.children.length > 0){
			this.children[0].destroy();
		}

		this.children = 
		impex._cs[this._uid] = null;
		delete impex._cs[this._uid];

		this.refs = 
		this.__nodes = 
		this.__syncFn = 
		this._uid = 

		this.__url = 
		this.template = 
		this.state = null;
	},
	onPropChange : function(newProps,oldProps){
		for(var k in newProps){
			var v = newProps[k];
			if(isObject(v)){
				var copy = v instanceof Array?[]:{};
				this.state[k] = Object.assign(copy,v);
			}else if(v !== this.state[k]){
				this.state[k] = v;
			}
		}
    }
};

/*********	component handlers	*********/
//////	init flow
function buildOffscreenDOM(vnode,comp){
	var n,cid = comp._uid;
	if(isUndefined(vnode.txt)){
		n = document.createElement(vnode.tag);
		n._vid = vnode.vid;
		vnode._cid = cid;

		if(!vnode._comp){//component dosen't exec directive
			//directive init
			var dircts = vnode._directives;
			if(dircts && dircts.length>0){
				dircts.forEach(function(di){
					var dName = di[1][0];
					var d = DIRECT_MAP[dName];
					if(!d)return;
					
					var params = di[1][1];
					var v = di[2];
					var exp = di[3];
					d.onBind && d.onBind(vnode,{comp:comp,value:v,args:params,exp:exp});
				});
			}
		}

		for(var k in vnode.attrNodes){
			if(k[0] === BIND_AB_PRIFX)continue;
			n.setAttribute(k,vnode.attrNodes[k]);
		}

		if(vnode.attrNodes[ATTR_REF_TAG]){
			comp.refs[vnode.attrNodes[ATTR_REF_TAG]] = n;
		}
		
		if(vnode._comp){
			var c = newComponentOf(vnode,vnode.tag,n,comp,vnode._slots,vnode._slotMap,vnode.attrNodes);
			vnode._comp = c;
		}else{
			if(vnode.children && vnode.children.length>0){
				for(var i=0;i<vnode.children.length;i++){
					var c = buildOffscreenDOM(vnode.children[i],comp);
					n.appendChild(c);
				}
			}
		}
		
	}else{
		n = document.createTextNode(filterEntity(vnode.txt));
	}
	vnode.dom = n;
	return n;
}
function filterEntity(str){
	return str.replace?str.replace(/&lt;/img,'<').replace(/&gt;/img,'>'):str;
}

function callDirectiveUpdate(vnode,comp){
	if(isUndefined(vnode.txt)){
		if(!vnode._comp){//component dosen't exec directive
			//directive init
			var dircts = vnode._directives;
			if(dircts && dircts.length>0){
				dircts.forEach(function(di){
					var dName = di[1][0];
					var d = DIRECT_MAP[dName];
					if(!d)return;
					
					var params = di[1][1];
					var v = di[2];
					var exp = di[3];
					d.onUpdate && d.onUpdate(vnode,{comp:comp,value:v,args:params,exp:exp},vnode.dom);
				});
			}

			if(vnode.children && vnode.children.length>0){
				for(var i=0;i<vnode.children.length;i++){
					callDirectiveUpdate(vnode.children[i],comp);
				}
			}//end if
		}//end if
	}
}
function bindScopeStyle(name,css){
	if(!css)return;
	var cssStr = scopeStyle(name,css);
	if(!COMP_CSS_MAP[name]){
		//attach style
		if(cssStr.trim().length>0){
			var target = document.head.children[0];
			if(target){
				target.insertAdjacentHTML('afterend','<style>'+cssStr+'</style>');
			}else{
				document.head.innerHTML = '<style>'+cssStr+'</style>';
			}
		}
		COMP_CSS_MAP[name] = true;	
	}
}
/**
 * parse component template & to create vdom
 */
function parseComponent(comp){
	if(comp.__url){
		loadComponent(comp.name,comp.__url,function(model,css){
			COMP_MAP[comp.name] = model;
			ext(model,comp);
			preCompile(comp.template,comp);
			
			//css
			bindScopeStyle(comp.name,css);
			comp.__url = null;
			compileComponent(comp);
			mountComponent(comp);
		});
	}else{
		if(comp.template){
			preCompile(comp.template,comp);
		}
		compileComponent(comp);
	}
}
function preCompile(tmpl,comp){
	if(comp.onBeforeCompile)
        tmpl = comp.onBeforeCompile(tmpl);
    
    comp.compiledTmp = tmpl = tmpl.replace(/^\s+|\s+$/img,'').replace(/>\s([^<]*)\s</,function(a,b){
            return '>'+b+'<';
    });
}
function doSlot(slotList,slots,slotMap){
	if(slots || slotMap)
		slotList.forEach(function(slot){
			var parent = slot[0];
			var node = slot[1];
			var name = slot[2];
			//update slot position everytime
			var pos = parent.children.indexOf(node);
			var params = [pos,1];
			
			if(name){
				params.push(slotMap[name]);
			}else{
				params = params.concat(slots);
			}
			parent.children.splice.apply(parent.children,params);
		});
}
function scopeStyle(host,style){
	style = style.replace(/\n/img,'').trim()//.replace(/:host/img,host);
	var isBody = false;
	var selector = '';
	var body = '';
	var lastStyle = {};
	var styles = [];
	for(var i=0;i<style.length;i++){
		var c = style[i];
		if(isBody){
			if(c === '}'){
				isBody = false;
				lastStyle.body = body.trim();
				selector = '';
				styles.push(lastStyle);
				lastStyle = {};
			}
			body += c;
		}else{
			if(c === '{'){
				isBody = true;
				lastStyle.selector = selector.trim();
				body = '';
				continue;
			}
			selector += c;
		}
	}

	var css = '';
	host = '['+DOM_COMP_ATTR+'="'+host+'"]';
	styles.forEach(function(style){
		var parts = style.selector.split(',');
		var tmp = '';
		for(var i=0;i<parts.length;i++){
			var name = parts[i].trim();
			
			if(name.indexOf(':host')===0){
				tmp += ','+name.replace(/:host/,host);
			}else{
				tmp += ','+host + ' ' + name;
			}
		}
		tmp = tmp.substr(1);
		css += tmp + '{'+style.body+'}';
	});

	return css;
}
function compileComponent(comp){
	var vnode = buildVDOMTree(comp);
	var pv = null;
	if(comp.vnode){
		pv = comp.vnode.parent;
		var cs = pv.children;
		var i = cs.indexOf(comp.vnode);
		if(i>-1){
			cs.splice(i,1,vnode);
		}
	}
	comp.vnode = vnode;
	vnode.parent = pv;

	//observe state
	comp.state = Observer.observe(comp.state,comp);

	comp.onCompile && comp.onCompile(comp.vnode);//must handle slots before this callback 
}
/**
 * 准备挂载组件到页面
 */
function mountComponent(comp,parentVNode){
	var dom = buildOffscreenDOM(comp.vnode,comp);

	//beforemount
	comp.onBeforeMount && comp.onBeforeMount(dom);
	comp.el.parentNode.replaceChild(dom,comp.el);
	comp.el = dom;

	//init children
	for(var i = comp.children.length;i--;){
		parseComponent(comp.children[i]);
	}
	//mount children
	for(var i = 0;i<comp.children.length;i++){
		if(!comp.children[i].__url)
			mountComponent(comp.children[i],comp.vnode);
	}
	if(comp.name){
		comp.el.setAttribute(DOM_COMP_ATTR,comp.name);
		comp.vnode.setAttribute(DOM_COMP_ATTR,comp.name);
	}
	comp.onMount && comp.onMount(comp.el);

	comp.vnode.parent = parentVNode;

	callDirectiveUpdate(comp.vnode,comp);
}

//////	update flow
function updateComponent(comp,changes){
	var renderable = true;
	var syncPropMap = {};
	
	if(comp.onBeforeUpdate){
		renderable = comp.onBeforeUpdate(changes);
	}
	if(renderable === false)return;

	//rebuild VDOM tree
	var vnode = buildVDOMTree(comp);
	comp.onCompile && comp.onCompile(vnode);

	//diffing
	var forScopeQ = compareVDOM(vnode,comp.vnode,comp,forScopeQ);

	//call watchs
	if(comp.__watchFn){
		var newVal = comp.__watchFn(comp.state);
		for(var k in newVal){
			var nv = newVal[k];
			var ov = comp.__watchOldVal[k];
			if(nv !== ov){
				comp.__watchMap[k].call(comp,nv,ov);
			}
		}
		comp.__watchOldVal = newVal;
	}	

	//update children props
	for(var uid in comp.__syncFn){
		var changeProps = {};
		var args = [comp.state];
		if(forScopeQ[uid])comp.__syncFnForScope[uid] = forScopeQ[uid];
		var sfs = comp.__syncFnForScope[uid];
	    if(sfs)
	        for(var i=0;i<sfs.length;i++){
	            args.push(sfs[i]);
	        }
		var rs = comp.__syncFn[uid].apply(comp,args);
		impex._cs[uid].onPropChange && impex._cs[uid].onPropChange(rs,comp.__syncOldVal[uid]);
		comp.__syncOldVal[uid] = rs;
	}

	comp.onUpdate && comp.onUpdate();

	callDirectiveUpdate(comp.vnode,comp);
}



function newComponent(tmpl,el,param){
	var c = new Component(el);
	c.compiledTmp = tmpl;
	if(param){
		ext(param,c);

		if(isFunction(param.state)){
			c.state = param.state.call(c);
		}
	}
	
	return c;
}
function newComponentOf(vnode,type,el,parent,slots,slotMap,attrs){
	var param = COMP_MAP[type];
	var c = new Component(el);
	c.name = type;
	//bind parent
	parent.children.push(c);
	c.parent = parent;
	c.vnode = vnode;
	//ref
	if(attrs[ATTR_REF_TAG]){
		parent.refs[attrs[ATTR_REF_TAG]] = c;
	}
	//global
	if(attrs[ATTR_G_TAG]){
		impex.g[attrs[ATTR_G_TAG]] = c;
	}

	if(isString(param)){
		c.__url = param;
		return c;
	}
	if(param){
		ext(param,c);
		
		if(isFunction(param.state)){
			c.state = param.state.call(c);
		}else if(param.state){
			c.state = {};
			ext(param.state,c.state);
		}
	}
	c.compiledTmp = param.template;
	c.__slots = slots;
	c.__slotMap = slotMap;
	
	bindProps(c,parent,attrs);
	
	return c;
}

function bindProps(comp,parent,parentAttrs){
	//check props
	var requires = {};
	var propTypes = comp.propTypes;
	if(propTypes){
		for(var k in propTypes){
			var type = propTypes[k];
			if(type.require){
				requires[k] = type;
			}
		}
	}

	if(parentAttrs){
		handleProps(parentAttrs,comp,parent,propTypes,requires);
	}

	//check requires
	var ks = Object.keys(requires);
	if(ks.length > 0){
		error("props ["+ks.join(',')+"] of component["+comp.name+"] are required");
		return;
	}
}
function handleProps(parentAttrs,comp,parent,propTypes,requires){
	var str = '';
	for(var k in parentAttrs){
		var v = parentAttrs[k];
		if(k == ATTR_REF_TAG){
			continue;
		}
		k = k.replace(/-[a-z0-9]/g,function(a){return a[1].toUpperCase()});
		// xxxx
		if(k[0] !== PROP_TYPE_PRIFX){
			if(propTypes && k in propTypes){
				delete requires[k];
				checkPropType(k,v,propTypes,comp);
			}
			comp.state[k] = v;
			continue;
		}

		// .xxxx
		var n = k.substr(1);
		str += ','+JSON.stringify(n)+':'+v;
	}//end for
	str = str.substr(1);
	var forScopeStart = '',forScopeEnd = '';
	var vn = comp.vnode;
	var args = [parent.state];
	var sfs = parent.__syncFnForScope[comp._uid] = [];
    if(vn._forScopeQ)
        for(var i=0;i<vn._forScopeQ.length;i++){
            forScopeStart += 'with(arguments['+(1+i)+']){';
            forScopeEnd += '}';
            args.push(vn._forScopeQ[i]);
            sfs.push(vn._forScopeQ[i]);
        }
	var fn = parent.__syncFn[comp._uid] = new Function('scope','with(scope){'+forScopeStart+'return {'+str+'}'+forScopeEnd+'}');
	var rs = parent.__syncOldVal[comp._uid] = fn.apply(parent,args);
	var objs = [];
	for(var k in rs){
		var v = rs[k];
		if(isObject(v) && v.__im__oid){
			objs.push(k);
		}
		if(propTypes && k in propTypes){
			delete requires[k];
			checkPropType(k,v,propTypes,comp);
		}
	}
	if(objs.length>0){
		warn("ref parameters '"+objs.join(',')+"' should be read only");
	}
	if(comp.onPropBind){
		comp.onPropBind(rs);
	}else{
		for(var k in rs){
			var v = rs[k];
			if(v instanceof Function){
				comp[k] = v;
			}else{
				comp.state[k] = v;
			}
		}
	}//end if	
}

function checkPropType(k,v,propTypes,component){
	if(!propTypes[k] || !propTypes[k].type)return;
	var checkType = propTypes[k].type;
	checkType = checkType instanceof Array?checkType:[checkType];
	var vType = typeof v;
	if(v instanceof Array){
		vType = 'array';
	}
	if(vType !== 'undefined' && checkType.indexOf(vType) < 0){
		error("invalid type ["+vType+"] of prop ["+k+"] of component["+component.name+"];should be ["+checkType.join(',')+"]");
	}
}

	var CMD_PREFIX = 'x-';//指令前缀
	var CMD_PARAM_DELIMITER = ':';
	var CMD_FILTER_DELIMITER = '.';

	var EXP_START_TAG = '{{',
		EXP_END_TAG = '}}';
	var REG_CMD = /^x-.*/;
	var ATTR_REF_TAG = 'ref';
	var ATTR_G_TAG = 'impex-g';
	var COMP_SLOT_TAG = 'component';
	var PROP_TYPE_PRIFX = '.';
	// var PROP_SYNC_SUFX = ':sync';
	// var PROP_SYNC_SUFX_EXP = /:sync$/;

	var EV_AB_PRIFX = ':';
	var BIND_AB_PRIFX = '.';

	var EXP2HTML_EXP_TAG = '#';
	var EXP2HTML_START_EXP = /^\s*#/;
	var FILTER_EXP_START_TAG = '=>';
	var FILTER_EXP_START_TAG_ENTITY = '=&gt;';
	var FILTER_EXP_SPLITTER = '|';
	var FILTER_EXP_PARAM_SPLITTER = ':';

	var DOM_COMP_ATTR = 'data-impex-compoment';

	var SLOT = 'slot';

	var im_counter = 0;

	var DISPATCHERS = [];
	var FILTER_MAP = {};
	var DIRECT_MAP = {};
	var COMP_MAP = {};
	var EVENT_MAP = {};
	var COMP_CSS_MAP = {};
	var SHOW_WARN = true;

	function warn(msg){
		console && console.warn('impex warn :: ' + msg);
	}

	function error(msg){
		console && console.error('impex error :: ' + msg);
	}


	/**
	 * impex是一个用于开发web应用的组件式开发引擎，impex可以运行在桌面或移动端
	 * 让你的web程序更好维护，更好开发。
	 * impex的目标是让开发者基于web技术以最低的学习成本获得最大的收益，所以impex会尽量简单。
	 * impex由组件、指令、过滤器和服务这几个概念构成
	 * @namespace 
	 * @author {@link https://github.com/MrSoya MrSoya}
	 */
	var impex = new function(){

		/**
		 * 保存注册过的全局组件实例引用。
		 * 注册全局组件可以使用impex-g属性.
		 * <p>
		 * 		<x-panel impex-g="xPanel" >...</x-panel>
		 * </p>
		 * <p>
		 * 		impex.g.xPanel.todo();
		 * </p>
		 * @type {Object}
		 */
		this.g = {};

		/**
	     * 版本信息
	     * @type {Object}
	     * @property {Array} v 版本号
	     * @property {string} state
	     * @property {function} toString 返回版本
	     */
		this.version = {
	        v:[0,96,0],
	        state:'alpha',
	        toString:function(){
	            return impex.version.v.join('.') + ' ' + impex.version.state;
	        }
	    };
	    /**
	     * 官网地址
	     * @type {String}
	     * @constant
	     */
		this.website = 'http://impexjs.org';

		/**
		 * 设置impex参数
		 * @param  {Object} cfg 参数选项
		 * @param  {String} cfg.delimiters 表达式分隔符，默认{{ }}
		 * @param  {int} cfg.showWarn 是否显示警告信息
		 */
		this.config = function(cfg){
			var delimiters = cfg.delimiters || [];
			EXP_START_TAG = delimiters[0] || '{{';
			EXP_END_TAG = delimiters[1] || '}}';
			SHOW_WARN = cfg.showWarn===false?false:true;
		};

		/**
		 * 定义组件<br/>
		 * 定义的组件实质是创建了一个组件类的子类，该类的行为和属性由model属性
		 * 指定，当impex解析对应指令时，会动态创建子类实例<br/>
		 * @param  {string} name  组件名，全小写，必须是ns-name格式，至少包含一个"-"
		 * @param  {Object | String} param 组件参数对象，或url地址
		 * @return this
		 */
		this.component = function(name,param){
			if(typeof(param)!='string' && !param.template){
				error("can not find property 'template' of component '"+name+"'");
			}
			COMP_MAP[name] = param;
			return this;
		}

		/**
		 * 定义指令
		 * @param  {string} name  指令名，不带前缀
		 * @param  {Object} data 指令定义
		 * @return this
		 */
		this.directive = function(name,param){
			DIRECT_MAP[name] = param;
			return this;
		}

		/**
		 * 定义过滤器。过滤器可以用在表达式或者指令中
		 * <p>
		 * 	{{ exp... => cap}}
		 * </p>
		 * 过滤器可以连接使用，并以声明的顺序依次执行，比如
		 * <p>
		 * 	{{ exp... => lower|cap}}
		 * </p>
		 * 过滤器支持参数，比如
		 * <p>
		 * 	{{ exp... => currency:'€':4}}
		 * </p>
		 * <p>
		 * 	x-for="list as item => orderBy:'desc'"
		 * </p>
		 * @param  {string} name 过滤器名
		 * @param  {Function} to 过滤函数。回调参数为 [value,params...]，其中value表示需要过滤的内容
		 * @return this
		 */
		this.filter = function(name,to){
			FILTER_MAP[name] = to;
			return this;
		}

		/**
		 * 对单个组件进行测试渲染
		 */
		this.unitTest = function(compName,entry,model){
			window.onload = function(){
	            'use strict';
	            
                var subModel = component();
                var tmpl = document.querySelector('template');
                tmpl = tmpl.innerHTML;
                var css = '';
	            tmpl = tmpl.replace(/<\s*style[^<>]*>([\s\S]*?)<\s*\/\s*style\s*>/img,function(a,b){
	                css += b;
	                return '';
	            });
	            subModel.template = tmpl;
	            //register
	            impex.component(compName,subModel);

	            bindScopeStyle(compName,css);

	            //register requires
	            var links = document.querySelectorAll('link[rel="impex"]');
	            for(var i=links.length;i--;){
	                var lk = links[i];
	                var type = lk.getAttribute('type');
	                var href = lk.getAttribute('href');
	                impex.component(type,href);
	            }

	            //render
	            impex.render(document.querySelector(entry),model);
	        }
		}

		/**
		 * 渲染一段HTML匿名组件到指定容器，比如
		 * <pre>
		 * 	<div id="entry"></div>
		 * 	...
		 * 	impex.renderTo('<x-app></x-app>','#entry'...)
		 * </pre>
		 * @param  {String} tmpl 字符串模板
		 * @param  {HTMLElement | String} container 匿名组件入口，可以是DOM节点或选择器字符
		 * @param  {Object} param 组件参数，如果节点本身已经是组件，该参数会覆盖原有参数 
		 * @param  {Array} [services] 需要注入的服务，服务名与注册时相同，比如['ViewManager']
		 */
		this.renderTo = function(tmpl,container,param){
			
			//link comps
			var links = document.querySelectorAll('link[rel="impex"]');

            //register requires
            for(var i=links.length;i--;){
                var lk = links[i];
                var type = lk.getAttribute('type');
                var href = lk.getAttribute('href');
                impex.component(type,href);
            }

            if(isString(container)){
            	container = document.querySelector(container);
            }
            if(container.tagName === 'BODY'){
            	error("container element must be inside <body> tag");
            	return;
            }

            tmpl = tmpl.replace(/<!--[\s\S]*?-->/mg,'')
            		.replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/mg,'')
            		.trim();
			var comp = newComponent(tmpl,container,param);

			comp.onCreate && comp.onCreate();
			parseComponent(comp);
			mountComponent(comp);

			return comp;
		}

		/**
		 * 渲染一个DOM节点组件，比如
		 * <pre>
		 * 	<x-stage id="entry"><x-stage>
		 * 	...
		 * 	impex.render('#entry'...)
		 * </pre>
		 * 如果DOM元素本身并不是组件,系统会创建一个匿名组件，也就是说
		 * impex总会从渲染一个组件作为一切的开始
		 * @param  {HTMLElement | String} node 组件入口，可以是DOM节点或选择器字符
		 * @param  {Object} param 组件参数，如果节点本身已经是组件，该参数会覆盖原有参数 
		 */
		this.render = function(node,param){
			if(isString(node)){
            	node = document.querySelector(node);
            }
            var tmpl = node.outerHTML;
            return this.renderTo(tmpl,node,param);
		}

		Object.defineProperty(this,'_cs',{enumerable: false,writable: true,value:{}});

		//for prototype API
		this.Component = Component;
	}


/**
 * 内建指令
 */
///////////////////// 视图控制指令 /////////////////////
/**
 * 内联样式指令
 * <br/>使用方式：
 * <div x-style="{'font-size': valExp}" >...</div>
 * <div x-style="{'fontSize': valExp}" >...</div>
 * <div x-style="'color:red;font-size:20px;'" >...</div>
 * <div x-style="obj" >...</div>
 */
impex.directive('style',{
    onBind:function(vnode,data){
        var v = data.value;
        if(isString(v)){
            var rs = {};
            var tmp = v.split(';');
            for(var i=tmp.length;i--;){
                if(!tmp[i])continue;
                var pair = tmp[i].split(':');
                rs[pair[0]] = pair[1];
            }
            v = rs;
        }
        var style = vnode.getAttribute('style')||'';
        for(var k in v){
            var n = this.filterName(k);
            var val = v[k];
            n = n.replace(/[A-Z]/mg,function(a){return '-'+a.toLowerCase()});
            style += n+':'+val+';';
            // if(val.indexOf('!important')){
            //     val = val.replace(/!important\s*;?$/,'');
            //     n = n.replace(/[A-Z]/mg,function(a){return '-'+a.toLowerCase()});
            //     style.setProperty(n, v, "important");
            // }else{
            //     style[n] = val;
            // }
        }
        vnode.setAttribute('style',style);
    },
    filterName:function(k){
        return k.replace(/-([a-z])/img,function(a,b){
            return b.toUpperCase();
        });
    }
})
/**
 * 外部样式指令
 * <br/>使用方式：
 * <div x-class="'cls1 cls2 cls3 ...'" >...</div>
 * <div x-class="['cls1','cls2','cls3']" >...</div>
 * <div x-class="{cls1:boolExp,cls2:boolExp,cls3:boolExp}" >...</div>
 */
.directive('class',{
    onBind:function(vnode,data){
        var v = data.value;
        var cls = vnode.getAttribute('class')||'';
        if(isString(v)){
            cls += ' '+v;
        }else if(isArray(v)){
            cls += ' '+ v.join(' ');
        }else{
            for(var k in v){
                var val = v[k];
                if(val)
                    cls += ' '+k;
            }
        }            
        
        vnode.setAttribute('class',cls);
    }
})
/**
 * 绑定视图事件，以参数指定事件类型，用于减少单一事件指令书写
 * <br/>使用方式1：<img x-on:load:mousedown:touchstart="hi()" x-on:dblclick="hello()">
 * <br/>使用方式2：<img :load:mousedown:touchstart="hi()" :dblclick="hello()">
 */
.directive('on',{
    onBind:function(vnode,data){
        var args = data.args;
        for(var i=args.length;i--;){
            vnode.on(args[i],data.value);
        }
    }
})
/**
 * 绑定视图属性，并用表达式的值设置属性
 * <br/>使用方式：<img x-bind:src="exp">
 */
.directive('bind',{
    onBind:function(vnode,data){
        var args = data.args;
        if(!args || args.length < 1){
            warn('at least one attribute be binded');
        }
        for(var i=args.length;i--;){
            var p = args[i];
            vnode.setAttribute(p,data.value);
        }
    }
})
/**
 * 控制视图显示指令，根据表达式计算结果控制
 * <br/>使用方式：<div x-show="exp"></div>
 */
.directive('show',{
    onBind:function(vnode,data){
        var v = data.value;
        var style = vnode.getAttribute('style')||'';
        if(v){
            style += ';display:;'
        }else{
            style += ';display:none;'
        }
        
        vnode.setAttribute('style',style);
    }
})
///////////////////// 模型控制指令 /////////////////////
/**
 * 绑定模型属性，当控件修改值后，模型值也会修改
 * <br/>使用方式：<input x-model="model.prop">
 */
.directive('model',{
    onBind:function(vnode,data){
        vnode.toNum = vnode.getAttribute('number');
        vnode.debounce = vnode.getAttribute('debounce')>>0;
        vnode.exp = data.exp;
        vnode.on('change',this.handleChange);
        vnode.on('input',handleInput);
    },
    handleChange:function(e,vnode){
        var el = e.target;
        var tag = el.tagName.toLowerCase();
        var val = el.value;
        switch(tag){
            case 'textarea':
            case 'input':
                var type = el.getAttribute('type');
                switch(type){
                    case 'radio':
                        handleInput(e,vnode,this);
                        break;
                    case 'checkbox':
                        changeModelCheck(e,vnode,this);
                        break;
                }
                break;
            case 'select':
                var mul = el.getAttribute('multiple');
                if(mul !== null){
                    var parts = [];
                    for(var i=el.options.length;i--;){
                        var opt = el.options[i];
                        if(opt.selected){
                            parts.push(opt.value);
                        }
                    }
                    this.setState(vnode.exp,parts);
                }else{
                    handleInput(e,vnode,this);
                }
                
                break;
        }
    }
});

function handleInput(e,vnode,comp){
    var v = (e.target || e.srcElement).value;
    if(!isUndefined(vnode.toNum)){
        v = parseFloat(v);
    }
    if(vnode.debounce){
        if(vnode.debounceTimer){
            clearTimeout(vnode.debounceTimer);
            vnode.debounceTimer = null;
        }
        var that = this;
        vnode.debounceTimer = setTimeout(function(){
            clearTimeout(vnode.debounceTimer);
            vnode.debounceTimer = null;
            
            that.setState(vnode.exp,v);
        },vnode.debounce);
    }else{
        if(!this){
            comp.setState(vnode.exp,v);
        }else{
            this.setState(vnode.exp,v);
        }
    }
}
function changeModelCheck(e,vnode,comp){
    var t = e.target || e.srcElement;
    var val = t.value;
    var str = 'with(scope){return '+vnode.exp+'}';
    var fn = new Function('scope',str);
    var parts = null;
    if(!this){
        parts = fn(comp.state);
    }else{
        parts = fn(this.state);
    }
    if(!isArray(parts)){
        parts = [parts];
    }
    if(t.checked){
        parts.push(val);
    }else{
        var i = parts.indexOf(val);
        if(i > -1){
            parts.splice(i,1);
        }
    }
}
impex.filter('json',function(v){
    return JSON.stringify(v);
})

//filterBy:'xxx'
//filterBy:'xxx':'name'
//filterBy:filter
.filter('filterBy',function(v,key,inName){
    var ary = v;
    if(!isArray(ary)){
        warn('can only filter array');
        return v;
    }
    var rs = [];
    if(isFunction(key)){
        for(var i=ary.length;i--;){
            var need = key.call(this,ary[i]);
            if(need){
                rs.unshift(ary[i]);
            }
        }
    }else{
        for(var i=ary.length;i--;){
            var item = ary[i];
            if(inName){
                if(!key || (item[inName]+'').indexOf(key) > -1){
                    rs.unshift(item);
                }
            }else{
                if(!key || item.indexOf && item.indexOf(key) > -1){
                    rs.unshift(item);
                }
            }
        }
    }
    return rs;
})

//[1,2,3,4,5] => limitBy:3:1   ----> [2,3,4]
.filter('limitBy',function(v,count,start){
    if(!isArray(v)){
        warn('can only filter array');
        return v;
    }
    if(!count)return v;
    return v.splice(start||0,count);
})

//[1,2,3,4,5] => orderBy:'':'desc'   ----> [5,4,3,2,1]
.filter('orderBy',function(v,key,dir){
    if(!key && !dir)return v;
    if(!isArray(v)){
        warn('can only filter array');
        return v;
    }
    v.sort(function(a,b){
        var x = key?a[key]:a,
            y = key?b[key]:b;

        if(typeof x === "string"){
            return x.localeCompare(y);
        }else if(typeof x === "number"){
            return x - y;
        }else{
            return (x+'').localeCompare(y);
        }
    });
    if(dir === 'desc'){
        v.reverse();
    }
    return v;
});

 	if ( typeof module === "object" && typeof module.exports === "object" ) {
 		module.exports = impex;
 	}else{
 		global.impex = impex;
 	}

 }(window||this);