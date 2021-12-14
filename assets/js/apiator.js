


(function ($) {
	FrontBone = {};
	let itemsArr = {};
	let db = {};

	const EDIT_BUTTON_ACTION = "showEditModal";
	const ADD_BUTTON_ACTION = "showCreateModal";
	const DELETE_BUTTON_ACTION = "showDeleteConfirm";
	const NULL_ENTRY_VALUE = "/__null_entry__/";

	/**
	 *
	 * @param data
	 * @param db (db)
	 */
	function parseItemData(data,db)
	{
		let obj = {};
		let jsonApiObj = data.data;


		// retrieve self URL
		if(data.hasOwnProperty("links") && data.links && data.links.hasOwnProperty("self"))
			obj.url = URL(data.links.self);

		// fill info
		let jsonApiItem = data.hasOwnProperty("data")?data.data:data;
		let tmp = db.__get(jsonApiItem);
		if(tmp===null)
			tmp = {};
		obj = deepmerge(obj,tmp);

		// no relationships => job done & return
		if(!obj.relationships)
			return obj;

		// iterate relationships data and create Item Objects

		Object.getOwnPropertyNames(obj.relationships).forEach(function (relName) {
			// empty 1:1 relation
			if(obj.relationships[relName]===null)
				return;

			let relUrl = null;
			if(jsonApiObj.relationships[relName].hasOwnProperty("links")
				&& jsonApiObj.relationships[relName].links.hasOwnProperty("related"))
				relUrl = jsonApiObj.relationships[relName].links.related;

			let relData = obj.relationships[relName];




			// 1:1 relation
			if(obj.relationships[relName].constructor===Object) {
				let opts = {
					url: relUrl
				};
				obj.relationships[relName] = Item(opts).loadFromData(obj.relationships[relName]);
				// console.log(obj.relationships[relname]);
			}


			// 1:n relationship
			if(obj.relationships[relName].constructor===Array)
				obj.relationships[relName].map(function (itm) {
					let found = db.__get(itm);

					if(found)
						return Item({url: relUrl}).loadFromData(itm);
					else
						return Item({url: relUrl}).loadFromData(found);
				});
		});

		return obj;
	}

	function deepmerge(target, source, optionsArgument)
	{
		function defaultArrayMerge(target, source, optionsArgument) {
			let destination = target.slice();
			source.forEach(function(e, i) {
				if (typeof destination[i] === 'undefined') {
					destination[i] = cloneIfNecessary(e, optionsArgument);
				} else if (isMergeableObject(e)) {
					destination[i] = deepmerge(target[i], e, optionsArgument);
				} else if (target.indexOf(e) === -1) {
					destination.push(cloneIfNecessary(e, optionsArgument));
				}
			});
			return destination
		}

		function isMergeableObject(val) {
			var nonNullObject = val && typeof val === 'object'

			return nonNullObject
				&& Object.prototype.toString.call(val) !== '[object RegExp]'
				&& Object.prototype.toString.call(val) !== '[object Date]'
		}

		function emptyTarget(val) {
			return Array.isArray(val) ? [] : {}
		}

		function cloneIfNecessary(value, optionsArgument) {
			let clone = optionsArgument && optionsArgument.clone === true;
			return (clone && isMergeableObject(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
		}


		function mergeObject(target, source, optionsArgument) {
			let destination = {};

			if (isMergeableObject(target)) {
				Object.keys(target).forEach(function (key) {
					destination[key] = cloneIfNecessary(target[key], optionsArgument)
				})
			}

			Object.keys(source).forEach(function (key) {
				if (!isMergeableObject(source[key]) || !target[key]) {
					destination[key] = cloneIfNecessary(source[key], optionsArgument)
				} else {
					destination[key] = deepmerge(target[key], source[key], optionsArgument)
				}
			});
			return destination
		}

		let array = Array.isArray(source);
		let options = optionsArgument || { arrayMerge: defaultArrayMerge };
		let arrayMerge = options.arrayMerge || defaultArrayMerge;

		if (array) {
			return Array.isArray(target) ? arrayMerge(target, source, optionsArgument) : cloneIfNecessary(source, optionsArgument);
		} else {
			return mergeObject(target, source, optionsArgument);
		}
	}

	deepmerge.all = function deepmergeAll(array, optionsArgument)
	{
		if (!Array.isArray(array) || array.length < 2) {
			throw new Error('first argument should be an array with at least two elements');
		}

		// we are sure there are at least 2 values, so it is safe to have no initial value
		return array.reduce(function(prev, next) {
			return deepmerge(prev, next, optionsArgument);
		})
	};


	/**
	 *
	 * @param eventNames
	 * @returns {{}}
	 * @constructor
	 */
	function EventsEmitter(eventNames)
	{
		if(typeof eventNames!=="object" )
			throw "Invalid Events Emiter initializer";

		let ee = {
		};

		let events = {};
		if(eventNames.constructor===Array)
			eventNames.forEach(function(eventName){
				events[eventName] = [];
			});
		else
			Object.getOwnPropertyNames(eventNames).forEach(function(eventName){
				events[eventName] = eventNames[eventName];
			});

		/**
		 *
		 * @param eventName
		 * @param event
		 */
		ee.dispatch = function (eventName,event) {

			if(!events.hasOwnProperty(eventName))
				return;
			event.type = eventName;
			events[eventName].forEach(function (listener) {
				(async function(listener) {
					listener(event);
				})(listener);
			});
		};

		/**
		 *
		 * @param eventName
		 * @param listener
		 */
		ee.on = function (eventName,listener) {
			if(!events.hasOwnProperty(eventName))
				return;
			events[eventName].push(listener);
		};

		/**
		 *
		 * @param eventName
		 */
		ee.off = function (eventName) {
			if(!ee.hasOwnProperty(eventName))
				return;
			events[eventName] = [];
		};

		return ee;
	}


	/**
	 *
	 * @param options
	 * @returns {{}|*}
	 */
	function parseOptions(options)
	{
		if(typeof options==="undefined") {
			return {};
		}

		if(options.constructor===Object) {
			return options;
		}

		throw ["Invalid options",options];
	}

	/**
	 *
	 * @param doc
	 */
	function flattenDoc(doc)
	{
		let arr = [];
		if(doc.hasOwnProperty("data") && doc.data!==null) {
			if(doc.data.constructor===Array)
				arr = doc.data;
			else
				arr.push(doc.data)
		}
		if(doc.hasOwnProperty("includes"))
			arr = arr.concat(doc.includes);

		arr.forEach(function (item) {
			if(!itemsArr.hasOwnProperty(item.type+"/"+item.id))
				itemsArr[item.type+"/"+item.id] = item;
		});
		return arr;
	}

	/**
	 *
	 * @param data
	 * @returns {{__get: __get, __add: __add}}
	 */
	function buildDb(data)
	{
		let db = {
			__get: function (resName,keyId) {
				if(!resName)
					return  null;

				if(resName.constructor===Object && resName.hasOwnProperty("id") && resName.hasOwnProperty("type")) {
					keyId = resName.id;
					resName = resName.type
				}

				if(!this.hasOwnProperty(resName))
					return null;

				if(!this[resName].hasOwnProperty(keyId))
					return  null;

				return this[resName][keyId];
			},
			__add: function (resName,keyId,data) {
				if(!resName)
					return  null;

				if(resName.constructor===Object && resName.hasOwnProperty("id") && resName.hasOwnProperty("type")) {
					keyId = resName.id;
					resName = resName.type
					if(resName.hasOwnProperty("data"))
						data = resName.data;
				}

				if(!this.hasOwnProperty(resName))
					this[resName] = {};

				if(!this[resName].hasOwnProperty(keyId))
					this[resName][keyId] = {
						id: keyId,
						type: resName
					};

				if(data)
					this[resName][keyId] = data;

				return this[resName][keyId];
			}
		};

		if(data.hasOwnProperty("data")) {
			db = deepmerge(db, parseDataProperty(data.data));
		}

		if(data.hasOwnProperty("includes")) {
			db = deepmerge(db, parseIncludesProperty(data.includes));
		}


		/**
		 * fix relations
		 */
		Object.getOwnPropertyNames(db).forEach(function (resName) {
			Object.getOwnPropertyNames(db[resName]).forEach(function (keyId) {
				if(!db[resName][keyId])
					return;

				if(!db[resName][keyId].hasOwnProperty("relationships"))
					return;

				Object.getOwnPropertyNames(db[resName][keyId].relationships).forEach(function (relName) {
					if(!db[resName][keyId].relationships[relName].hasOwnProperty("data") || !db[resName][keyId].relationships[relName].data) {
						db[resName][keyId].relationships[relName] = null;
						return;
					}


					let relTmp = db[resName][keyId].relationships[relName].data;

					if(relTmp.constructor===Object) {
						let tmp = db.__get(relTmp);
						if(!tmp)
							tmp = db.__add(relTmp);
						db[resName][keyId].relationships[relName] = tmp;
					}

					if(relTmp.constructor===Array) {
						db[resName][keyId].relationships[relName] = [];
						for(let i=0;i<relTmp.length;i++) {
							let tmp = db.__get(relTmp[i].type,relTmp[i].id);
							db[resName][keyId].relationships[relName].push(tmp?tmp:relTmp[i]);
						}
					}

				})
			});
		});

		/**
		 *
		 * @param data
		 */
		function parseDataProperty(data)
		{
			let db = {};
			if(!data)
				return db;

			if(data.constructor===Object)
				data = [data];

			if(data.constructor!==Array)
				return db;

			return addItems2Db(data);
		}

		/**
		 *
		 * @param data
		 */
		function parseIncludesProperty(data)
		{
			let db = {};
			if(!data || data.constructor!==Array)
				return db;

			return addItems2Db(data);

		}

		/**
		 *
		 * @param items
		 */
		function addItems2Db(items)
		{
			let db = {};
			items.forEach(function (item) {
				if(!item.hasOwnProperty("attributes") && !item.hasOwnProperty("relationships"))
					return;
				if(!db.hasOwnProperty(item.type))
					db[item.type] = {};
				db[item.type][item.id] = item;
			});
			return db;
		}
		return db;
	}



	/**
	 *
	 * @param options
	 * @returns {{relationships: null, view: null, attributes: null, id: null, collection: null, type: null, url: null}}
	 */
	function Item(options)
	{
		let _item = {
			id: null,
			type: null,
			attributes: {},
			relationships: {},
			views: [],
			collection: null,
			url: null,
			updateUrl: null,
			deleteUrl: null,
			strict: false
		};


		let eventTypes = ['load'];
		Object.assign(_item,EventsEmitter(eventTypes));

		Object.assign(_item,parseOptions(options));
		let storage = Storage();

		_item.setUrl = function (url) {
			if(url.constructor===String) {
				this.url = URL(url);
				this.updateUrl = Object.assign({},this.url);
				this.deleteUrl = Object.assign({},this.url);
			}


			if(url.hasOwnProperty("url"))
				this.url = URL(url.url);
			if(url.hasOwnProperty("updateUrl"))
				this.updateUrl = URL(url.updateUrl);
			if(url.hasOwnProperty("deleteUrl"))
				this.deleteUrl = URL(url.deleteUrl);
			return this;
		};

		_item.url = URL(_item.url);
		_item.deleteUrl = URL(_item.deleteUrl?_item.deleteUrl:_item.url);
		_item.updateUrl = URL(_item.updateUrl?_item.updateUrl:_item.url);


		_item.views.forEach(function (view) {
			view.item = _item;
		});


		/**
		 *
		 * @param jqXHR
		 * @param textStatus
		 * @param errorThrown
		 * @param _self
		 */
		function fail(jqXHR, textStatus, errorThrown) {
			if(jqXHR.status===404) {
				// _self.view.renderEmpty();
				_item.views.forEach(function (view) {
					view.renderEmpty();
				});
			}
		}

		_item.loadFromRemote = function() {
			return _item.load_from_data_source();
		};

		/**
		 * load item data from data source storage.
		 * @returns {Promise<unknown>}
		 */
		_item.load_from_data_source = function () {
			return new Promise(function (resolve,reject) {
				if(!_item.url) {
					throw("No valid URL provided");
				}

				storage.read(_item,_item.url,{})
					.then(function (resp) {
						let data = resp.data;
						let textStatus = resp.textStatus;
						let jqXHR = resp.jqXHR;
						let ctx = resp.ctx;
						_item
							.loadFromJSONAPIDoc(data, textStatus, jqXHR, ctx)
							.views.forEach(function (view){
							view.render();
						});

						resolve(_item);
					})
					.catch(function(jqXHR, textStatus, errorThrown)
					{
						// console.log("fail to load resource",_item.url,jqXHR, textStatus, errorThrown);
						fail(jqXHR, textStatus, errorThrown);
						reject(jqXHR);
					});

			});
		};

		_item.unbindView = function(view)
		{
			let found = false;
			for(let i=0;i<this.views.length;i++) {
				if(this.views[i]===view) {
					found = i
				}
			}
			if(found!==false) {
				this.views.splice(found,1)
			}

		};


		/**
		 *
		 * @param view
		 */
		_item.bindView = function(view) {

			view = ItemView(view);
			// console.log("55555555555555555",view);

			let bound = false;
			_item.views.forEach(function (v) {
				console.log("view exists");
				if(v===view) {
					bound = true;
				}
			});

			if(bound) {
				return;
			}
			view.item = _item;
			_item.views.push(view);
			return this;
		};

		/**
		 * method is used when loading item from remote (either not part of a collection)
		 * @param data
		 * @param text
		 * @param xhr
		 * @param ctx
		 * @returns {_item}
		 */
		_item.loadFromJSONAPIDoc = function (data,text,xhr,ctx) {
			let obj;

			if(this.hasOwnProperty("collection")) {
				obj = this;
			}
			else if(ctx && ctx.hasOwnProperty("collection")) {
				obj = ctx;
			}

			if(data.data && data.data.constructor===Array) {
				throw "Invalid configuration: resource type is item but server response is collection";
			}

			let db = buildDb(data);

			Object.assign(obj,parseItemData(data,db));

			obj.url = URL(obj.url);

			// dispatch event
			return this;
		};

		/**
		 * loads data statically from data parameter
		 * @param data
		 * @param text
		 * @param xhr
		 * @param ctx
		 * @returns {_item}
		 */
		_item.loadFromData = function (data) {
			// throw "Asa";
			let obj;

			if(this.hasOwnProperty("collection"))
				obj = this;

			else if(ctx && ctx.hasOwnProperty("collection"))
				obj = ctx;

			Object.assign(obj,data);

			return this;
		};


		/**
		 *
		 * @param xhr
		 * @param statusText
		 * @param error
		 */
		_item.fail = function (xhr,statusText,error) {
			// console.log(xhr,statusText,error);
			// this.view.renderEmpty();
			this.view.forEach(function (view) {
				view.renderEmpty();
			});
		};


		/**
		 *
		 * @returns {{attributes: _item.attributes, type: _item.type}}
		 */
		_item.toJSON = function () {
			let json = {
				type: this.type,
				attributes: this.attributes
			};
			if (this.id)
				json.id = this.id;
			if (this.attributes)
				json.attributes = this.attributes;

			if (!this.hasOwnProperty("relationships"))
				return json;

			json.relationships = {};

			for (let relName in this.relationships) {
				if (!this.relationships.hasOwnProperty(relName))
					continue;

				json.relationships[relName] = {
					data: null,
				};

				if (this.relationships[relName] === null)
					continue;

				// 1:1 relation
				if (this.relationships[relName].constructor === Object) {
					json.relationships[relName].data = this.relationships[relName].hasOwnProperty("toJSON")
						? this.relationships[relName].toJSON() : this.relationships[relName];
					continue;
				}

				// invalid relation data (not null, not an object, not an array)
				if (this.relationships[relName].constructor !== Array) {
					delete this.relationships[relName];
					delete json.relationships[relName];
					continue;
				}

				// 1:n relations
				json.relationships[relName].data = [];
				for (let i = 0; i < this.relationships[relName].length; i++) {
					let tmp = this.relationships[relName][i].hasOwnProperty("toJSON")
						? this.relationships[relName][i].toJSON()
						: this.relationships[relName][i];
					json.relationships[relName].data.push(tmp);
				}
			}
			console.log(json);
			return json;
		};

		/**
		 *
		 */
		_item.update = function (itemData) {

			let toUpdate = {
				id: this.id,
				type: this.type,
				attributes: {},
				relationships: {}
			};

			// check attributes
			Object.getOwnPropertyNames(itemData).forEach(function (attrName) {
				if(itemData[attrName] && typeof itemData[attrName]==="object") {
					return ;
				}

				if(!this.attributes.hasOwnProperty(attrName) && !this.strict ) {
					// console.log("Attr '"+attrName+"'not present in parent object and strict mode off => add attr to update");
					return toUpdate.attributes[attrName] = itemData[attrName];
				}

				if(!this.attributes.hasOwnProperty(attrName) && this.strict ) {
					// console.log("Attr '"+attrName+"'not present in parent object and strict mode ON => skip");
					return;
				}

				if(itemData[attrName]!==this.attributes[attrName]) {
					// console.log("Attr '"+attrName+"'  update value "+itemData[attrName]+" differs in value than current value "+this.attributes[attrName]+" => add to update");
					return toUpdate.attributes[attrName] = itemData[attrName];
				}

			}, this);

			// update relationships
			if(this.relationships) {
				Object.getOwnPropertyNames(this.relationships).forEach(function (relName) {
					if (!itemData.hasOwnProperty(relName)) {
						return;
					}


					if(itemData[relName]===null || typeof itemData[relName] !== "object") {
						return;
					}

					if(toUpdate.attributes.hasOwnProperty(relName))
						return;

					if (this.relationships[relName] == null || this.relationships[relName].id !== itemData[relName]) {

						if (this.relationships[relName] === null || this.relationships[relName].id === null)
							toUpdate.relationships[relName] = {
								data: null
							};
						else {
							toUpdate.relationships[relName] = {
								data: {
									id: itemData[relName]
								}
							};
							if (this.relationships[relName] && this.relationships[relName].hasOwnProperty("type"))
								toUpdate.relationships[relName].data.type = this.relationships[relName].type;
						}


						console.log("update " + relName);
					}
					// if(this.relationships[rel])
				}, this);
			}

			return new Promise(function (resolve,reject) {
				if(!Object.getOwnPropertyNames(toUpdate.attributes).length
					&& !Object.getOwnPropertyNames(toUpdate.relationships).length) {
					resolve(_item);
				}

				let patchData = JSON.stringify({data: toUpdate});

				storage.update(_item,_item.updateUrl, {},patchData)
					.then(function (resp)
					{
						let newData = parseItemData(resp.data,buildDb(resp.data));
						Object.assign(_item,newData);

						_item.views.forEach(function (view){
							view.render();
						});

						resolve(_item);
					})
					.catch(function (xhr)
					{
						// console.log("Update NOK",_item.updateUrl,patchData,xhr);
						reject(xhr);
					});
			});

		};

		_item.remove = function() {
			console.log("removing");
			for(let i=_item.views.length-1 ; i>=0 ; i--) {
				_item.views[i].remove();
			}

			if(!_item.collection) {
				return;
			}
			console.log(_item,_item.collection,_item.collection.children);
			for(i=0;i<_item.collection.items.length;i++) {
				if(_item.collection.items[i].id===_item.id) {
					_item.collection.items.splice(i,1);
					break;
				}
			}
		};

		/**
		 * delete item
		 */
		_item.delete = function () {
			return new Promise((resolve,reject) => {
				// set deleteUrl
				_item.deleteUrl = _item.deleteUrl  ? _item.deleteUrl : _item.url + "/" + _item.id;


				function onDeleteFail(resp) {
					console.log("fail",resp);
					reject(resp);
				}

				// remove from storage
				storage.delete(_item,_item.deleteUrl,{})
					.then(
						function () {
							_item.remove();
							resolve();
						}

					)
					.catch(reject)
					// .finally(()=>{console.log("finaly",arguments)});
			});

		};

		_item.getUtilities = function () {
			return utilities;
		};

		return _item;
	}


	/**
	 * Functions to perform usefull stuff
	 * @type {{fillForm: fillForm, captureFormSubmit: captureFormSubmit}}
	 */
	let utilities = {
		// fill form fields with data from instance
		fillForm: function(form,instance) {
			if($(form).prop("tagName")!=="FORM"	)
				return null;

			if(!instance || !instance.hasOwnProperty("attributes"))
				return null;

			let attributes = {};

			form = $(form)[0];

			Object.getOwnPropertyNames(instance.attributes).forEach(function (attrName) {
				if(!form.elements.hasOwnProperty(attrName))
					return;
				let val = instance.attributes[attrName];
				let inp = $(form.elements[attrName]);
				if(instance.attributes[attrName] && typeof instance.attributes[attrName]==="object" && instance.attributes[attrName].hasOwnProperty("id"))
					val = instance.attributes[attrName].id;
				if(inp.attr('type')==='date') {
					val = val ? val.substr(0, 10) : val;
				}
				inp.val(val);

				// console.log("set ",attrName,val);

			});

			if(!instance.hasOwnProperty("relationships"))
				return ;

			if(instance.relationships)
				Object.getOwnPropertyNames(instance.relationships).forEach(function (relName) {
					// console.log("test rel "+relName);
					if(!form.elements.hasOwnProperty(relName))
						return;

					if(!instance.relationships[relName])
						return $(form.elements[relName]).val(null);

					if(instance.relationships[relName].constructor===Array) {

						let vals = [];
						instance.relationships[relName].forEach(function (relItem) {
							vals.push(relItem.id);
						});
						$(form.elements[relName]).val(vals);
					}
					else {
						console.log("set ",relName,instance.relationships[relName]);
						$(form.elements[relName]).val(instance.relationships[relName].id);
					}

				});
		},

		// capture form submit event and redirect it to callback
		captureFormSubmit: function(form,cb) {
			if($(form).prop("tagName")!=="FORM" || typeof cb!=="function")
				return null;


			// setup submit processing
			$(form).off("submit").on("submit",function(event) {
				// console.log("form submit triggered",event);
				event.preventDefault();
				let frm = $(form)[0];
				let formElements = {};
				Object.getOwnPropertyNames( frm.elements).forEach(function (item) {
					let $item = $(frm.elements[item]);
					if(!$item.attr("name") || $item.attr("name")==="")
						return;
					formElements[$item.attr("name")] = $item.val();
				});
				// console.log(formElements,"////////////////",cb);

				cb(formElements);
			});
		}

	};


	/**
	 *
	 * @param params
	 * @returns {{template: null, container: null, item: null, el: null}}
	 */
	function ItemView(params)
	{
		// params is actually an existing ItemView
		if(params.isView) {
			return params;
		}

		// params is actually a jquery object or an html node
		if(params.length || params.nodeName) {
			let $el = $(params);
			if($el.data("view")) {
				return $el.data("view");
			}

			let tmp = $("<div>").append($el.clone(true));
			let html = tmp.html()
				.replace(/&lt;%/gi, '<%')
				.replace(/%&gt;/gi, "%>")
				.replace(/&amp;/gi, "&");

			params = {
				template: _.template(html),
				el: $el
			};
			if($el.attr("id")) {
				params.id = $el.attr("id");
			}
			tmp.remove();

		}

		let _itemview = {
			dataBindings: null,
			template: null,
			container: null,
			collectionView: null,
			item: null,
			el: null,
			id: uid(),
			isView: true
		};

		params = parseOptions(params);

		Object.assign(_itemview,params);


		if(_itemview.el !== null) {
			_itemview.dataBindings = getBoundObjects(_itemview.el);
		}

		let a = {}

		let tmp = {};
		Object.assign(tmp,_itemview);

		// todo: remove this check in future release
		if (!_itemview.template) {
			throw "Invalid ItemView template";
		}

		let eventTypes = ['render','reset'];
		Object.assign(_itemview,EventsEmitter(eventTypes));


		function createElementFromTemplate() {
			let el = $(_itemview.template(_itemview.item))
				.attr("data-type","item")
				.attr("id", _itemview.id)
				.data("view",_itemview)
				.data("instance",_itemview.item);

			_itemview.dataBindings = _itemview.dataBindings ? _itemview.dataBindings : _itemview.item.collection.view.dataBindings;

			for(let key in _itemview.dataBindings) {
				el.data(key,_itemview.dataBindings[key]);
				el.find("*").data(key,_itemview.dataBindings[key]);
			}

			el.find("*").data("instance",_itemview.item);
			return el;
		}

		_itemview.unbind = function() {
			this.item.unbindView(this);
		};

		/**
		 *
		 * @param returnView should be true when the element should not be rendered into the DOM
		 * @returns {null|jQuery}
		 */
		_itemview.render = function (returnView) {

			let renderedEl = createElementFromTemplate();

			if(returnView) {
				this.el = renderedEl;
				return this.el;
			}


			if(!_itemview.el) {
				delete renderedEl;
				console.log("Invalid item view element");
				return null;
			}

			renderedEl.insertBefore(this.el[0]);

			this.el.remove();
			this.el = renderedEl;

			return this.el;
		};

		_itemview.renderEmpty = function(returnView) {
			if(_itemview.item.emptyview && this.el) {
				this.el.replaceWith(_itemview.item.emptyview.clone(true).css("display","block"));
			}
		};

		_itemview.remove = function (idx) {
			_itemview.el.fadeOut({
				complete: ()=>{
					_itemview.el.remove();
				}
			});

		};
		return _itemview;
	}


	/**
	 * URL object factory method
	 * @param url
	 * @returns {{path: string, protocol: string, fragment: string, fqdn: string, port: string, toString: (function(): string), parameters: string}|null}
	 * @constructor
	 */
	function URL(url)
	{

		if(!url)
			return null;

		if(typeof url==="object" && url.hasOwnProperty("protocol") )
			return url;

		if(url.constructor!==String) {
			throw "URL is not a string: " + url.toString();
		}

		let regExp = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
		let parts = regExp.exec(url);
		let urlObj = {
			protocol: parts[1],
			fqdn: parts[3],
			port: parts[4],
			path: parts[5],
			parameters: parts[6]?parts[6]:"",
			fragment: parts[7],
			toString: function () {
				let str = "";
				if(this.protocol && this.fqdn)
					str += this.protocol+"://"+this.fqdn;
				if(this.port)
					str += this.port;
				if(this.fqdn)
					str +=  "/";
				if(this.path)
					str += this.path;
				if(this.parameters) {
					str += "?" + this.parameters.toString();
				}
				if(this.fragment)
					str += "#"+this.fragment;
				return str;
			}
		};


		if(parts[1]===undefined) {
			urlObj.path = parts[2]+parts[3]+"/"+parts[5];
			urlObj.protocol = null;
			urlObj.fqdn = null;
			urlObj.port = null;
		}

		if(urlObj.parameters) {
			let tmp = urlObj.parameters.split("&");
			urlObj.parameters = {};
			tmp.forEach(function (item) {
				if(!item || item==="")
					return;
				let eqPos = item.indexOf("=");
				if(eqPos===-1)
					urlObj.parameters[item] = "";
				urlObj.parameters[item.substr(0,eqPos)] = item.substr(eqPos+1);
			});

		}
		else {
			urlObj.parameters = {};
		}

		urlObj.parameters.toString = function () {
			let paras = [];
			for(let para in this) {
				if(this.hasOwnProperty(para) && para!=="toString")
					paras.push(para+"="+this[para]);
			}
			return paras.join("&");
		};

		return urlObj;
	}

	/**
	 *
	 * @param opts
	 * @returns {{template: null, view: null, total: null, offset: number, navtype: string, pageSize: number, paging: null, url: null}}
	 */
	function Collection(opts)
	{
		let _collection = {
			url: null,
			deleteUrl: null,
			insertUrl: null,
			updateUrl: null,
			paging:null,
			view: null,
			offset: 0,
			total: null,
			pageSize: 10,
			template: null,
			navtype: "page",
			type: null,
			emptyview: null,
			items: [],
		};

		_collection.setPageSize = function(val) {
			if(/^\d+$/.test(val)) {
				_collection.pageSize = val;
				return true;
			}

			return false;
		};
		_collection.setOffset = function(val) {
			if(/^\d+$/.test(val)) {
				_collection.offset = val;
				return true;
			}
			return false;

		};

		_collection.setUrl = function(url) {
			if(!url) {
				return ;
			}
			if(url.constructor===String) {
				this.url = URL(url);
				this.setPageSize(this.url.parameters["page["+_collection.type+"][limit]"]);
				this.setOffset(this.url.parameters["page["+_collection.type+"][offset]"]);

				this.updateUrl = Object.assign({},this.url);
				this.deleteUrl = Object.assign({},this.url);
				this.insertUrl = Object.assign({},this.url);
			}

			if(url.hasOwnProperty("url")) {
				this.url = URL(url.url);
				this.setOffset(this.url.parameters["page["+_collection.type+"][offset]"]);
				this.setPageSize(this.url.parameters["page["+_collection.type+"][limit]"]);
			}
			if(url.hasOwnProperty("updateUrl"))
				this.updateUrl = URL(url.updateUrl);
			if(url.hasOwnProperty("deleteUrl"))
				this.deleteUrl = URL(url.deleteUrl);
			if(url.hasOwnProperty("insertUrl"))
				this.insertUrl = URL(url.insertUrl);

			return this;
		};
		opts = parseOptions(opts);


		let eventTypes = ['load'];
		Object.assign(_collection,EventsEmitter(eventTypes));

		Object.assign(_collection,opts);

		_collection.setUrl(_collection.url);
		// _collection.url = URL(_collection.url);
		if(_collection.deleteUrl) {
			_collection.setUrl({deleteUrl:_collection.deleteUrl});
		}
		if(_collection.updateUrl) {
			_collection.setUrl({updateUrl:_collection.updateUrl});
		}
		if(_collection.insertUrl) {
			_collection.setUrl({insertUrl:_collection.insertUrl});
		}

		if(_collection.view) {
			_collection.view.collection = _collection;
		}

		// if(_collection.url && _collection.url.parameters) {
		// 	_collection.setOffset(_collection.url.parameters["page["+_collection.type+"][offset]"]);
		// 	_collection.setPageSize(_collection.url.parameters["page["+_collection.type+"][limit]"]);
		// }

		if(_collection.total) {
			_collection.total = _collection.total * 1;
		}

		if(["page","scroll"].indexOf(_collection.navtype)===-1)
			throw "Invalid navigations type. Should be page or scroll";

		let storage = opts.hasOwnProperty("storage") ? opts.storage : (
			opts.hasOwnProperty("ajaxOpts") ? Storage(opts.ajaxOpts) : Storage()
		);
		/**
		 *
		 * @param data
		 * @returns {{template: null, insertUrl: null, offset: number, pageSize: number, paging: null, type: null, url: null, view: null, total: null, navtype: string, updateUrl: null, deleteUrl: null, emptyview: null}|{relationships: null, view: null, attributes: null, id: null, collection: null, type: null, url: null}}
		 */
		_collection.receiveRemoteData = function (data) {
			// console.log(data);
			data = parse(data);

			if(data == null)
				return;

			// received data is a collection
			if(data.constructor===Array) {
				data.forEach(function (item) {
					appendItemToCollection(_collection,_collection.loadItem(item));
				});

				return _collection.render();
			}

			// received data is an item => add it
			if(data.constructor===Object) {
				return  appendItemToCollection(_collection,_collection.loadItem(data),true);
			}

		};

		function appendItemToCollection(collection,item,render) {
			if(render) {
				_collection.render();
			}
			return item;
		}

		/**
		 *
		 * @param data
		 */
		_collection.loadFromData = function (data) {
			if (data.constructor !== Array) {
				console.log(data);
				throw "Invalid data type received. Should be an array.";
			}

			if(_collection.navtype==="page")
				_collection.items = [];

			data.forEach(function (item) {
				_collection.loadItem(item);
			});

			_collection.view.render();
			return _collection;
		};

		_collection.clear = function() {
			_collection.items = [];
			_collection.render();
		};

		/**
		 *
		 * @returns {{template: null, insertUrl: null, offset: number, pageSize: number, paging: null, type: null, url: null, view: null, total: null, navtype: string, updateUrl: null, deleteUrl: null, items: [], emptyview: null}}
		 */
		_collection.render = function() {
			if(_collection.view && _collection.view.el) {
				_collection.view.render();
			}
			return _collection;
		};

		/**
		 *
		 * @returns {Promise<unknown>}
		 */
		_collection.loadFromRemote = function() {
			return _collection.load_from_data_source();
		};

		/**
		 * sync with datasource
		 * @returns {Promise<unknown>}
		 */
		_collection.load_from_data_source = function () {

			return  new Promise(function (resolve,reject) {
				if(!_collection.url) {
					throw("No valid URL provided");
				}

				if(typeof _collection.offset!== "undefined" && _collection.offset!==null) {
					_collection.url.parameters["page["+_collection.type+"][offset]"] = _collection.offset;
				}

				if(typeof _collection.pageSize!== "undefined" && _collection.pageSize!==null) {
					_collection.url.parameters["page["+_collection.type+"][limit]"] = _collection.pageSize;
				}

				storage.read(_collection,_collection.url,{})
					.then(function(res)
					{
						_collection.clear();
						_collection.receiveRemoteData(res.data);
						resolve(_collection);
					})
					.catch(function(jqXHR, textStatus, errorThrown)
					{
						_collection.fail(jqXHR, textStatus, errorThrown);
						reject(jqXHR);
					});
			});

		};

		_collection.fail = function (xhr, txt, err) {
			console.log(xhr, txt, err,_collection);
		};





		/**
		 *
		 * @param itemData
		 * @returns {{data: null}}
		 */
		function parseData4InsertUpdate(itemData)
		{

			if(itemData===null) {
				return null;
			}

			if(typeof itemData !== "object") {
				throw "Invalid item data: "+itemData;
			}

			if(itemData.constructor===Array) {
				let resource = [];
				itemData.forEach(function (item) {
					resource.push(parseData4InsertUpdate(item));
				});
				return resource;
			}

			if(itemData.constructor!==Object) {
				throw "Invalid case";
			}

			let resource = {};


			// if(!itemData.hasOwnProperty("type") && !itemData.hasOwnProperty("attributes") ) {
			if(!itemData.hasOwnProperty("attributes") ) {
				let tmp = {attributes:{}};
				Object.assign(tmp.attributes, itemData);
				itemData = tmp;
			}
			// else if(itemData.hasOwnProperty("type")) {
			// 	resource.type = itemData.type;
			// }

			Object.getOwnPropertyNames(itemData.attributes).forEach(function (attr) {
				if(itemData.attributes[attr] && typeof itemData.attributes[attr]==="object") {
					if(!resource.relationships) {
						resource.relationships = {}
					}
					resource.relationships[attr] = {
						data: parseData4InsertUpdate(itemData.attributes[attr])
					};
					return;
				}
				if(!resource.attributes) {
					resource.attributes = {}
				}
				resource.attributes[attr] = itemData.attributes[attr];
			});
			// for(let attr in itemData.attributes) {
			//
			// }

			return resource;
		}
		/**
		 *
		 * @param itemData
		 */
		_collection.createItem = function(itemData) {
			return _collection.append(itemData);
		};



		_collection.append = function(itemData) {
			let jsonApiDoc = {data: parseData4InsertUpdate(itemData)};
			let _self = this;

			return new Promise(function (resolve,reject) {
				if(!_self.insertUrl) {
					_self.insertUrl = _self.url;
				}
				console.log(JSON.stringify(jsonApiDoc));

				storage
					.create(_self,_self.insertUrl,{contentType:"application/vnd.api+json"},JSON.stringify(jsonApiDoc))
					.then(function (resp) {
						let data = resp.data;
						let newItem = _self.receiveRemoteData(data);
						resolve(newItem);
					})
					.catch(function (resp) {
						console.log("fail recv data");
						reject(resp);
					})
					.finally(function () {
						console.log("finally recv data");
					})
			});
		};

		_collection.removeItem = function(item) {
			for(let i=0;i<this.items.length;i++) {
				if(item===this.items[i]) {
					this.items.splice(i,1);
					break;
				}
			}
		};

		_collection.loadItem = function (itemData) {
			// throw new Error("asda");

			let opts = {
				type: _collection.type,
				collection: _collection
			};

			if(itemData.id && _collection.url) {
				opts.url = Object.assign({},_collection.url);
				opts.url.path += "/" + itemData.id;

				opts.updateUrl = _collection.updateUrl ? Object.assign({},_collection.updateUrl) :  Object.assign({},_collection.url);
				opts.updateUrl.path += "/" + itemData.id;

				opts.deleteUrl = _collection.deleteUrl ? Object.assign({},_collection.deleteUrl) :  Object.assign({},_collection.url);
				opts.deleteUrl.path += "/" + itemData.id;
			}


			let newItem = Item(opts)
				.bindView(ItemView({
					template: _collection.template,
					container: _collection.view
				}))
				.loadFromData(itemData);

			if(_collection.addontop) {
				_collection.items.unshift(newItem);
			}
			else {
				_collection.items.push(newItem);

			}

			return newItem;
		};


		/**
		 *
		 * @param data
		 */
		function parse(data) {
			flattenDoc(data);
			let doc = buildDb(data);
			// console.log(data);

			if (!data.hasOwnProperty("data"))
				return data;


			if (data.hasOwnProperty("meta")) {
				if (data.meta.hasOwnProperty("totalRecords"))
					_collection.total = data.meta.totalRecords*1;
				if (data.meta.hasOwnProperty("offset"))
					_collection.offset = data.meta.offset;

			}
			return data.data;
		}

		_collection.getUtilities = function () {
			return utilities;
		};

		return _collection;
	}


	/**
	 *
	 * @param options
	 * @returns {{container: null, el: null, collection: null, itemsContainer: null}}
	 */
	function CollectionView(options)
	{
		let _collectionView = {
			el: null,
			container: null,
			collection: null,
			itemsContainer: null,
			allowempty: true
		};



		let eventTypes = ['reset','render'];

		Object.assign(_collectionView,EventsEmitter(eventTypes));

		Object.assign(_collectionView,parseOptions(options));

		_collectionView.dataBindings = getBoundObjects(_collectionView.el);

		/**
		 *
		 * @returns {{container: null, el: null, collection: null, allowempty: boolean, itemsContainer: null}}
		 */
		_collectionView.reset = function () {
			if(this.allowempty) {
				_collectionView.itemsContainer.empty();
			}
			return _collectionView;
		};

		/**
		 *
		 * @returns {_collectionView}
		 */
		_collectionView.render = function () {
			if($(this.itemsContainer.css("display")==="none")) {
				$(this.itemsContainer).css("display", null);
			}

			if(this.collection.navtype==="page") {
				this.reset();
			}

			if(this.collection.items.length===0) {
				this.renderEmpty();
			}

			this.collection.items.forEach(function (item) {
				item.views.forEach(function (view) {
					if(view.container===this) {
						this.append(view.render(true));
					}
				},this);

			},this);


			if (this.collection.paging && typeof this.collection.paging==="object") {
				this.collection.paging.render();
			}


			// if(this.collection.items.lenght===0) {
			// 	$(this.collection.emptyview).css("display",null);
			// 	this.collection.paging.el.css("display",null);
			// }
			// else {
			// 	$(this.collection.emptyview).css("display","none");
			// 	this.collection.paging.el.css("display","none");
			// }


			return this;
		};

		_collectionView.renderEmpty = function() {
			if(!this.collection.emptyview)
				return this;

			this.reset().append(this.collection.emptyview);

		};

		_collectionView.append = function(el) {
			//
			// let cs = this.itemsContainer.children();
			// if(cs.length) {
			// 	console.log("before");
			// 	return $(cs[0]).before(el);
			// }
			return this.itemsContainer.append(el);
		};

		return _collectionView.reset();

	}


	FrontBone.Item = Item;
	FrontBone.ItemView = ItemView;

	/**
	 *
	 * @param opts
	 * @returns {$|void}
	 */
	$.fn.apiator = function (opts)
	{

		if(!this.length) {
			throw "Invalid element for apiator";
			// return console.log("Invalid element", opts, this);
		}

		if(typeof opts==="string") {
			opts = {
				url: opts,
			}
		}

		// extract data attributes from html element and assign them to
		let options = Object.assign({dataBindings: {}}, this.data());

		// assign options passed as
		Object.assign(options, parseOptions(opts));


		if (this.data("instance") !== undefined) {
			let instance = this.data("instance");

			if(options.url) {
				options.url = URL(options.url);
			}

			Object.assign(instance,parseOptions(options));

			if(Object.hasOwnProperty(options.url)) {
				instance.setUrl(options.url);
			}

			return options.returninstance ? instance : this;
		}

		// console.log("init apiator on ",this,options);
		if(options.hasOwnProperty("emptyview")) {
			options.emptyview = $(options.emptyview).remove();
		}

		// resource type unknown
		if (!options.hasOwnProperty("resourcetype"))
			throw new Error("Invalid resource type for APIATOR.JS (should be item or collection). " +
				"Please define a valid resource on element "+this.attr("id"));



		let instance;
		switch ( options.resourcetype) {
			case "collection":
				instance = createCollectionInstance.bind(this)(options);
				break;
			case "item":
				instance = createItemInstance.bind(this)(options);
				break;
			default:
				throw new Error("Invalid resource type for APIATOR.JS (should be item or collection)." +
					" Please define a valid resource on element "+this.attr("id"));
		}

		this.data("instance",instance);

		if(instance.url && (typeof instance.dontload==="undefined" || !instance.dontload)) {
			instance.loadFromRemote()
				.catch(function(error){
					console.log("error",error)
				})
			// .finally(()=>{
			// 	// console.log(instance,"instance loaded from server")
			// });
		}

		// console.log(instance);
		return (options.hasOwnProperty("returninstance") && opts.returninstance)?instance:this;
	};

	function getBoundObjects(el) {
		let db = {};
		if($(el).length===0) {
			return db;
		}

		let boundData = $(el).data();
		for (let key in boundData) {
			if (typeof boundData[key]==="object" && key!=="instance") {
				db[key] = boundData[key];
			}
		}
		return db;
	}

	/**
	 *
	 * @param options
	 * @returns {{template: null, view: null, total: null, offset: number, navtype: string, pageSize: number, paging: null, url: null}}
	 */
	function createCollectionInstance(options)
	{
		// extract template
		// set default to innerHTML

		let templateTxt = this[0].innerHTML;

		if(options.hasOwnProperty("template")) {
			let $tpl = $(options.template);
			if($(options.template).length)
				templateTxt = $(options.template)[0].outerHTML;
			else
				throw Error("Invalid collection template for instance #"+this.attr(id));
			$tpl.remove();
		}

		templateTxt = templateTxt
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, ">")
			.replace(/&apos;/gi, "'")
			.replace(/&quot;/gi, '"')
			.replace(/&nbsp;/gi, " ")
			.replace(/&amp;/gi, "&");
		options.template = _.template(templateTxt);


		let collectionConfig = {
			el: this,
			itemsContainer: options.hasOwnProperty("container") ? $(options.container) : this,
			allowempty: options.disableempty!==true
		};


		options.view = CollectionView(collectionConfig);

		let instance = Collection(options);

		// setup paging
		if (options.hasOwnProperty("paging") && $(options.paging).length) {
			instance.paging = Paging(options.paging, instance);
		}

		function sortNow ($lnk,setDir) {
			let fld = $lnk.data("sortfld");
			let oldDir = $lnk.data("sortdir");
			let $sortUp = $lnk.find(".sort-up");
			let $sortDown = $lnk.find(".sort-down");
			let $sortDefault = $lnk.find(".sort-default");
			let dir;
			let doNotLoad = false;
			switch(oldDir) {
				case "up":
					dir = "down";
					break;
				case "down":
					dir = null;
					break;
				default:
					dir = "up";
					break;
			}

			if(typeof setDir!=="undefined" && ["up","down",null].indexOf(setDir)!==-1) {
				dir = setDir;
				doNotLoad = true;
			}

			let inst = $lnk.data("instance");
			let sort = inst.url.parameters.hasOwnProperty("sort")?inst.url.parameters.sort:"";
			let sortArr = [];
			sort.split(",").forEach(function(item){
				let res = /^(-*)([a-z0-9\-\_]+)$/.exec(item.trim());
				if(!res)
					return;
				if(res[2]==fld)
					return;
				sortArr.push(item);
			});

			switch (dir) {
				case "up":
					sortArr.push("-"+fld);
					$lnk.data("sortdir","down");
					$sortUp.hide();
					$sortDown.show();
					$sortDefault.hide();
					break;
				case "down":
					$lnk.data("sortdir",null);

					$sortUp.hide();
					$sortDown.hide();
					$sortDefault.show();
					break;
				default:
					$lnk.data("sortdir","up");
					sortArr.push(fld);

					$sortUp.show();
					$sortDown.hide();
					$sortDefault.hide();
			}

			let nxtSort = sortArr.join(",");
			if(sort!==nxtSort) {
				inst.url.parameters.sort = nxtSort;
				// console.log(inst.url);
				if(!doNotLoad) {
					inst.loadFromRemote();
				}
			}
		}

		// configure sort
		if(options.hasOwnProperty("sort") && $(options.sort).length) {
			let $sort = $(options.sort);
			let sortFldsArr = instance.url && instance.url.parameters.sort ? instance.url.parameters.sort.split(",") : [];

			let sortFlds = {};
			sortFldsArr.forEach(function (item) {
				if(item[0]==="-") {
					sortFlds[item.substr(1)] = "down";
				}
				sortFlds[item.substr(1)] = "up";
			});

			$sort.find("[data-sortfld]").each(function(sort) {
				let sortUp = $(this).find(".sort-up").hide();
				let sortDown = $(this).find(".sort-down").hide();
				let sortDefault = $(this).find(".sort-default").show();

				$(this).data("instance",instance)
					.on("click",function (event) {
						sortNow($(event.target));
					});

				if(typeof  sortFlds[$(this).data("sortfld")]!=="undefined") {
					sortNow($(this),sortFlds[$(this).data("sortfld")]);
				}
			});
		}

		// setup filtering
		if (options.hasOwnProperty("filter") && $(options.filter).length && $(options.filter).prop("tagName")==="FORM") {
			instance.filtering = Filtering(options.filter, instance)
		}
		//
		// // setup edit modal
		// if(options.hasOwnProperty("addeditmodal")  && $(options.addeditmodal).length) {
		// 	$(options.addeditmodal).on("show.bs.modal", prepareModal);
		// }
		//
		// // setup confirm delete
		// if(options.hasOwnProperty("deletemodal") && $(options.deletemodal).length)
		// 	$(options.deletemodal).on("show.bs.modal",prepareDeleteModal);

		return instance;
	}

	/**
	 *
	 * @param options
	 * @returns {{relationships: null, view: null, attributes: null, id: null, collection: null, type: null, url: null}}
	 */
	function createItemInstance(options)
	{
		let container = options.hasOwnProperty("container") ? $(options.container) : this;

		// extract template
		let templateTxt = this[0].outerHTML
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, ">")
			.replace(/&apos;/gi, "'")
			.replace(/&quot;/gi, '"')
			.replace(/&nbsp;/gi, " ")
			.replace(/&amp;/gi, "&");
		options.template = _.template(templateTxt);

		return Item(options).bindView(ItemView({
			template: options.template,
			el: this,
			id: $(this).attr("id")?$(this).attr("id"):uid()
		}));
	}

	/*********************************************
	 * MODALs---------------------
	 ********************************************/

	/********************************************
	 * DELETE
	 ********************************************/
	function prepareDeleteModal(event)
	{
		let itemViewEl = $(event.relatedTarget).parents("[data-type=item]");
		let modal = this;

		// attach on click event to trigger delete action
		$(this).find("[data-action=confirmDelete]").off("click")
			.on("click",function (){
				itemViewEl.data("instance").delete( ()=>{
					$(modal).modal("hide");
				});
			});
	}


	/**********************************************
	 * ADD / UPDATE
	 ********************************************/
	function prepareModal(event)
	{
		let modal = $(this);
		let form = $(this).find("form")[0];
		form.reset();
		let targetInstance;

		let $button = $(event.relatedTarget);

		switch($button.data("action")) {
			case EDIT_BUTTON_ACTION:
				console.log("edit");
				targetInstance = $button.data("instance");
				if(!targetInstance)
					return console.log("Invalid targetInstance",event);

				$(form).data("instance",targetInstance);

				// add hidden id field
				if(!form.elements.hasOwnProperty("id")) {
					$(form).append("<input type=hidden name=id>");
				}

				// fill attributes values
				if(targetInstance.hasOwnProperty("attributes")) {
					Object.getOwnPropertyNames(targetInstance.attributes).forEach(function (attrName) {
						$(form[attrName]).val(targetInstance.attributes[attrName]);
					});
				}

				// fill relationships values
				if(targetInstance.hasOwnProperty("relationships") && targetInstance.relationships) {
					Object.getOwnPropertyNames(targetInstance.relationships).forEach(function (relName) {
						// console.log(item.relationships[relName],item.relationships[relName].id,item.relationships[relName].constructor);

						// null value
						if (targetInstance.relationships[relName] === null)
							$(form[relName]).val(null);

						// 1:1 relationships
						if (targetInstance.relationships[relName] && targetInstance.relationships[relName].constructor === Object)
							$(form[relName]).val(targetInstance.relationships[relName].id);

						// 1:n relationships
						if (targetInstance.relationships[relName] && targetInstance.relationships[relName].constructor === Array) {
							let relIds = [];
							targetInstance.relationships[relName].forEach(function (relation) {
								relIds.push(relation.id);
							});
							// if form element is select
							$(form[relName]).val(relIds);
						}
					});
				}

				form.method = "PATCH";
				form.action = targetInstance.url;
				break;
			case ADD_BUTTON_ACTION:
				targetInstance = $($button.data("instance")).data("instance");
				if(!targetInstance) {
					return console.log("Invalid targetInstance", event);
				}

				$(form).data("instance",targetInstance);
				if(form.elements.hasOwnProperty("id") && !$(form.elements.id).attr("data-required")) {
					$(form.elements.id).remove();
				}

				form.method = "POST";
				form.action = targetInstance.url;
				break;
			default:
				console.log("Invalid action ".$button.data("action"));
				return ;
		}

		$(form).off("submit").on("submit",function (event) {
			event.preventDefault();
			let form = this;
			let data = {};
			let instance = $(this).data("instance");
			for(let i=0;i<form.elements.length;i++) {
				if(form.elements[i].name) {
					data[form.elements[i].name] = $(form.elements[i]).val();
					if(data[form.elements[i].name]===NULL_ENTRY_VALUE) {
						data[form.elements[i].name] = null;
					}
				}
			}

			switch ($(form).attr("method").toUpperCase()) {
				case "POST":
					// instance is a collection
					console.log("-----------------",instance);
					instance.createItem(data);
					break;
				case "PATCH":
					// instance is an item
					// console.log(instance,data);
					instance.update(data);
					break;
			}
			$(modal).modal("hide");
			// console.log(data,this,event, $(this).data("instance"));
		});
	}

	/**
	 *
	 * @param filterForm
	 * @param collection
	 * @constructor
	 */
	function Filtering(filterForm,collection)
	{
		// normalize filterFrom to jquery object
		filterForm = $(filterForm);
		let _self = {
			collection: collection,
			el: filterForm
		};

		filterForm
			.data("instance",collection)
			.on("submit",function (e) {
				e.preventDefault();
				let filter = [];
				let frm = filterForm[0];
				for(let i=0; i<frm.elements.length;i++) {
					let el = frm.elements[i];
					let $el = $(el);
					if(el.name && $el.val()) {
						filter.push(
							el.name + ($el.data("operator") ? $el.data("operator") : "=") + $el.val()
						);
					}
				}
				// _self.collection.url.parameters["page["+_self.collection.type+"][offset]"] = 0;
				_self.collection.url.parameters["filter"] = filter.join(",");
				console.log(filter,_self.collection.url)
				_self.collection.loadFromRemote();
			})
			.on("reset",function () {
				delete _self.collection.url.parameters.filter;
				// _self.collection.url.parameters["page["+_self.collection.type+"][offset]"] = 0;
				_self.collection.loadFromRemote();
				console.log("reset");
			});
		return filterForm;
	}

	/**
	 *
	 * @param pagingEl
	 * @param collection
	 * @returns {{el: (jQuery.fn.init|jQuery|HTMLElement), collection: *}}
	 * @constructor
	 */
	function Paging(pagingEl,collection)
	{
		let _paging = {
			collection: collection,
			el: $(pagingEl),
		};

		let iniOffset = (_paging.collection.offset ? _paging.collection.offset : 0)*1;

		_paging.collection.paging = _paging;

		let defaultPageSize = 20;

		let $pageSizeInp = $(_paging.collection.pagesizeinp);
		if($pageSizeInp.length) {
			_paging.collection.setPageSize($pageSizeInp.val());
			$pageSizeInp.off("change").on("change",function () {
				if(_paging.collection.setPageSize($pageSizeInp.val())) {
					_paging.collection.loadFromRemote();
				}

			});
		}
		let pageSize = _paging.collection.pageSize;

		let $offsetInp = $(_paging.collection.offsetinp);
		if($offsetInp.length) {
			_paging.collection.setOffset($offsetInp.val());
			$offsetInp.off("change").on("change",function () {
				if(_paging.collection.setOffset($offsetInp.val())) {
					_paging.collection.loadFromRemote();
				}
			});
		}

		let buttons = {
			page: _paging.el.find("[name=page]").remove(),
			prev: _paging.el.find("[name=prev]").remove(true),
			next: _paging.el.find("[name=next]").remove(true),
			first: _paging.el.find("[name=first]").remove(true),
			last: _paging.el.find("[name=last]").remove(true),
		};

		let $totalCount =  $(_paging.collection.totalrecscount);

		_paging.el.empty();

		_paging.el.find("[data-type=pages]").empty();

		_paging.render = function () {

			let pagesToShow = 5;

			let total = _paging.collection.total;
			if($totalCount.length) {
				if($totalCount[0].tagName==="INPUT") {
					$totalCount.val(total);
				}
				else {
					$totalCount.text(total);
				}
			}
			_paging.el.empty();

			iniOffset = _paging.collection.offset*1;


			if(_paging.collection.pageSize) {
				pageSize = _paging.collection.pageSize;
			}
			else if(total-iniOffset-_paging.collection.items.length>0) {
				pageSize = _paging.collection.items.length;
			}
			else {
				pageSize = defaultPageSize;
			}

			pageSize = pageSize*1;
			if(pageSize>total) {
				return;
			}

			let first = buttons.first.clone(true).attr("title", 0);
			let prev = buttons.prev.clone(true).attr("title", iniOffset - pageSize);

			if(iniOffset>0) {
				first.on("click", function () {
					// _paging.collection.url.parameters["page["+_paging.collection.type+"][offset]"] = 0;
					_paging.collection.setOffset(0);
					_paging.collection.loadFromRemote();
				}).appendTo(_paging.el);

				prev.on("click", function () {
					// _paging.collection.url.parameters["page["+_paging.collection.type+"][offset]"] = iniOffset - pageSize;
					_paging.collection.setOffset(iniOffset-pageSize);
					_paging.collection.loadFromRemote();
				}).appendTo(_paging.el);
			}

			let lowerLimit = iniOffset / pageSize - Math.floor(pagesToShow/2);
			lowerLimit = lowerLimit<0 ? 0 : lowerLimit;

			let upperLimit = iniOffset / pageSize + Math.ceil(pagesToShow/2);
			upperLimit = upperLimit*pageSize<total ? upperLimit : Math.ceil(total/pageSize);

			for(let i=lowerLimit;i<upperLimit;i++) {

				let page = buttons.page.clone(true).text(i+1).on("click", function () {
					_paging.collection.setOffset(i*pageSize);
					// _paging.collection.url.parameters["page["+_paging.collection.type+"][offset]"] = i*pageSize;
					_paging.collection.loadFromRemote();
				}).attr("title", i*pageSize).appendTo(_paging.el);

				if(iniOffset/pageSize===i)
					page.addClass("active").off("click");
			}

			let nxtOffset = iniOffset + pageSize;
			let next = buttons.next.clone(true).attr("title", nxtOffset);

			let lastPageOffset = (Math.ceil(total/pageSize)-1)*pageSize;
			let last = buttons.last.clone(true).attr("title", lastPageOffset);
			if(iniOffset + pageSize <= total) {
				next.appendTo(_paging.el).on("click", function () {
					_paging.collection.setOffset(iniOffset+pageSize);
					// _paging.collection.url.parameters["page["+_paging.collection.type+"][offset]"] = iniOffset+pageSize;
					_paging.collection.loadFromRemote();
				});

				last.appendTo(_paging.el).on("click", function () {
					// _paging.collection.url.parameters["page["+_paging.collection.type+"][offset]"] = lastPageOffset;
					_paging.collection.setOffset(lastPageOffset);

					_paging.collection.loadFromRemote();
				});
			}
			$(_paging.collection.offsetinp).val(iniOffset);

		};

		return _paging;
	}

	/**
	 *
	 * @param options
	 * @constructor
	 */
	function Storage(options)
	{

		let defaultOptions = {
			url: null,
			method: "GET"
		};

		options = parseOptions(options);

		Object.assign(defaultOptions, options);

		let _storage = {};

		/**
		 *
		 * @param options
		 * @returns {Promise<unknown>}
		 */
		_storage.sync = function (options) {
			options = Object.assign(
				Object.assign({},defaultOptions),
				parseOptions(options)
			);

			if (!options.hasOwnProperty("url")) {
				throw "No URL provided";
			}

			return new Promise(function (resolve,reject) {
				$.ajax(options)
					.done(function (data, textStatus, jqXHR) {
						// console.log(data, textStatus, jqXHR,"111111111111");
						resolve( {
							data: data,
							textStatus: textStatus,
							jqXHR: jqXHR
						});
					})
					.fail(function (jqXHR, textStatus, errorThrown) {
						reject( {
							options: options,
							jqXHR: jqXHR,
							textStatus: textStatus,
							errorThrown: errorThrown
						});
					});
			});
		};

		/**
		 *
		 * @param ctx
		 * @param url
		 * @param opts
		 * @param data
		 * @returns {Promise<unknown>}
		 */
		_storage.create = function (ctx, url, opts, data) {
			let options = {
				context: ctx,
				url: url,
				method: "POST",
				data: data
			};
			Object.assign(options, opts);
			return _storage.sync(options);
		};

		/**
		 *
		 * @param ctx
		 * @param url
		 * @param opts
		 * @returns {Promise<unknown>}
		 */
		_storage.read = function (ctx, url, opts) {
			let options = {
				context: ctx,
				url: url,
				method: "GET"
			};
			Object.assign(options, opts);

			return _storage.sync(options);
		};

		/**
		 *
		 * @param ctx
		 * @param url
		 * @param opts
		 * @returns {Promise<unknown>}
		 */
		_storage.delete = function (ctx, url, opts) {
			let options = {
				context: ctx,
				url: url,
				method: "DELETE"
			};
			Object.assign(options, opts);

			return _storage.sync(options);
		};

		/**
		 *
		 * @param ctx
		 * @param url
		 * @param opts
		 * @param data
		 * @returns {Promise<unknown>}
		 */
		_storage.update = function (ctx, url, opts, data) {
			let options = {
				context: ctx,
				url: url,
				method: "PATCH",
				contentType: "application/vnd.api+json",
				data: data
			};
			Object.assign(options, opts);

			return _storage.sync(options);

		};

		return _storage;
	}

	function uid () {
		// Math.random should be unique because of its seeding algorithm.
		// Convert it to base 36 (numbers + letters), and grab the first 9 characters
		// after the decimal.
		return "uid_" + Math.random().toString(36).substr(2, 9);
	}

})($);


//
// $(document).ready(function () {
// 	$("[data-apiator]").each(function () {
// 		if(!$(this).data("instance"))
// 			$(this).apiator();
// 	});
// });
