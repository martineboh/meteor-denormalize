Denormalize = {};

/**
 * @property Denormalize.debug
 * @public
 *
 * Set to `true` to show debug messages.
 */
Denormalize.debug = false;

debug = function() {
	if(Denormalize.debug) console.log.apply(this, arguments);
};

changedFields = function(fields, doc1, doc2) {
	return _.filter(fields, function(field) {
		return Denormalize.getProp(doc1, field) !== Denormalize.getProp(doc2, field);
	});
}

object = function(key, value) {
	var result = {};
	result[key] = value;
	return result;
}

getFieldNamesObject = function(fields, obj1, obj2) {
	var result = {};
	_.each(fields, function(field) {
		var newValue = Denormalize.getProp(obj1, field);
		if(newValue !== Denormalize.getProp(obj2, field)) {
			result[field] = newValue;
		}
	});
	return result;
}

/**
 * @method Denormalize.fieldsJoiner
 * @private
 * @param {String[]} fields An array of the fields that should be concatenated
 * @param {String} glue A string that will be used as glue in the concatenation. Defaults to `', '`
 * @returns {Function} A callback that can be used in `collection.cacheField()`
 *
 * Generates a callback that can be used in `collection.cacheField()`. The value will be a concatenation of the fields using `glue`.
 */
Denormalize.fieldsJoiner = function(fields, glue) {
	if(!Match.test(glue, String)) {
		glue = ', ';
	}
	return function(doc, watchedFields) {
		if(fields === undefined) fields = watchedFields;
		return _.compact(_.map(fields, function(field) {
			return getProp(doc, field);
		})).join(glue);
	}
}

Denormalize.getRealCollection = getRealCollection = function(collection, validate) {
	return !validate && Package['aldeed:collection2'] ? collection._collection : collection;
}

Denormalize.getProp = getProp = function(obj, fields, returnObject) {
	if(_.isString(fields)) {
		var field = fields;
		if(returnObject) {
			var result = {};
			result[field] = getProp(obj, field);
			return result;
		} else {
			return _.reduce(field.split('.'), function(value, key) {
				if (_.isObject(value) && _.isFunction(value[key])) {
					return value[key]();
				} else if (_.isObject(value) && !_.isUndefined(value[key])) {
					return value[key];
				} else {
					return;
				}
			}, obj);
		}
	} else if(_.isArray(fields)) {
		if(returnObject) {
			return setProps({}, _.object(fields, getProp(obj, fields)));
		} else {
			return _.map(fields, function(field) {
				return getProp(obj, field);
			});
		}
	}
};

Denormalize.setProps = setProps = function(destination) {
	_.each(_.rest(arguments), function(obj) {
		_.each(obj, function(value, key) {
			var keys = key.split('.');
			var lastKey = keys.pop();
			var context = _.reduce(keys, function(context, key) {
				return context[key] = context[key] || {};
			}, destination);
			context[lastKey] = value;
		});
	});
	return destination;
};

Denormalize.haveDiffFieldValues = haveDiffFieldValues = function(fields, doc1, doc2) {
	return !!_.find(fields, function(field) {
		return Denormalize.getProp(doc1, field) !== Denormalize.getProp(doc2, field);
	});
}

Denormalize.runHooksNow = function(collection, selector) {
	var selector = selector || {};
	if(!collection._denormalize) return;

	collection.find(selector).forEach(function(doc) {
		var topLevelFieldNames = _.keys(doc);

		var currentRun = new DenormalizeRun();

		_.each(collection._denormalize.insert.hooks, function(hook) {

			var fieldValues = getFieldNamesObject(hook.watchedFields, doc, {});

			var context = new DenormalizeHookContext({
				fieldValues: fieldValues,
				doc: doc,
			}, currentRun);
			hook.callback.call(context, fieldValues, doc);
		});

		currentRun.commit();
	});
}
