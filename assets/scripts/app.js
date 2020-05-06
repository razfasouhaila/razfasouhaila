
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var yunex = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    const seen_callbacks = new Set();
    function flush() {
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.18.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/Components/Header/Header.svelte generated by Svelte v3.18.1 */
    const file = "src/Components/Header/Header.svelte";

    function create_fragment(ctx) {
    	let header;
    	let video;
    	let source;
    	let source_src_value;
    	let t0;
    	let section;
    	let img;
    	let img_src_value;
    	let t1;
    	let h1;
    	let t3;
    	let h2;

    	const block = {
    		c: function create() {
    			header = element("header");
    			video = element("video");
    			source = element("source");
    			t0 = space();
    			section = element("section");
    			img = element("img");
    			t1 = space();
    			h1 = element("h1");
    			h1.textContent = "Souhaila Razfa";
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Developpeuse web";
    			if (source.src !== (source_src_value = "./assets/video/background.mkv")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file, 6, 2, 106);
    			video.loop = true;
    			video.autoplay = true;
    			video.muted = true;
    			attr_dev(video, "class", "svelte-47oswl");
    			add_location(video, file, 5, 1, 76);
    			if (img.src !== (img_src_value = "./assets/images/logo.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Youness Boualam Logo");
    			attr_dev(img, "class", "svelte-47oswl");
    			add_location(img, file, 10, 2, 193);
    			attr_dev(h1, "class", "svelte-47oswl");
    			add_location(h1, file, 11, 2, 259);
    			attr_dev(h2, "class", "svelte-47oswl");
    			add_location(h2, file, 12, 2, 285);
    			attr_dev(section, "class", "svelte-47oswl");
    			add_location(section, file, 9, 1, 180);
    			attr_dev(header, "class", "svelte-47oswl");
    			add_location(header, file, 4, 0, 66);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, video);
    			append_dev(video, source);
    			append_dev(header, t0);
    			append_dev(header, section);
    			append_dev(section, img);
    			append_dev(section, t1);
    			append_dev(section, h1);
    			append_dev(section, t3);
    			append_dev(section, h2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/Components/Main/Hireme/Hireme.svelte generated by Svelte v3.18.1 */

    const file$1 = "src/Components/Main/Hireme/Hireme.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let form;
    	let label0;
    	let t3;
    	let input;
    	let t4;
    	let label1;
    	let t6;
    	let textarea;
    	let t7;
    	let button;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Engagez moi");
    			t1 = space();
    			form = element("form");
    			label0 = element("label");
    			label0.textContent = "Email";
    			t3 = space();
    			input = element("input");
    			t4 = space();
    			label1 = element("label");
    			label1.textContent = "Message";
    			t6 = space();
    			textarea = element("textarea");
    			t7 = space();
    			button = element("button");
    			button.textContent = "Engagez moi";
    			attr_dev(i, "class", "icon-hireme");
    			add_location(i, file$1, 18, 5, 357);
    			add_location(h3, file$1, 18, 1, 353);
    			attr_dev(label0, "for", "email");
    			attr_dev(label0, "class", "svelte-199rd3k");
    			add_location(label0, file$1, 21, 2, 413);
    			attr_dev(input, "type", "email");
    			attr_dev(input, "id", "email");
    			attr_dev(input, "placeholder", "your email here");
    			input.required = true;
    			attr_dev(input, "class", "svelte-199rd3k");
    			add_location(input, file$1, 22, 2, 448);
    			attr_dev(label1, "for", "message");
    			attr_dev(label1, "class", "svelte-199rd3k");
    			add_location(label1, file$1, 24, 2, 543);
    			attr_dev(textarea, "id", "message");
    			attr_dev(textarea, "placeholder", "Message text");
    			textarea.required = true;
    			attr_dev(textarea, "class", "svelte-199rd3k");
    			add_location(textarea, file$1, 25, 2, 582);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "svelte-199rd3k");
    			add_location(button, file$1, 27, 2, 679);
    			add_location(form, file$1, 20, 1, 403);
    			attr_dev(div, "class", "section svelte-199rd3k");
    			add_location(div, file$1, 17, 0, 330);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, form);
    			append_dev(form, label0);
    			append_dev(form, t3);
    			append_dev(form, input);
    			set_input_value(input, /*email*/ ctx[0]);
    			append_dev(form, t4);
    			append_dev(form, label1);
    			append_dev(form, t6);
    			append_dev(form, textarea);
    			set_input_value(textarea, /*message*/ ctx[1]);
    			append_dev(form, t7);
    			append_dev(form, button);

    			dispose = [
    				listen_dev(input, "input", /*input_input_handler*/ ctx[3]),
    				listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[4]),
    				listen_dev(button, "click", /*sendEmail*/ ctx[2], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*email*/ 1 && input.value !== /*email*/ ctx[0]) {
    				set_input_value(input, /*email*/ ctx[0]);
    			}

    			if (dirty & /*message*/ 2) {
    				set_input_value(textarea, /*message*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let email = "";
    	let message = "";

    	const sendEmail = e => {
    		e.preventDefault();

    		if (email != "" || message != "") {
    			let link = `mailto:razfasouhaila20@gmail.com?cc=${email}&subject=Creation%20de%20projet&body=${escape(message)}`;
    			window.location.href = link;
    			$$invalidate(0, email = "");
    			$$invalidate(1, message = "");
    		}
    	};

    	function input_input_handler() {
    		email = this.value;
    		$$invalidate(0, email);
    	}

    	function textarea_input_handler() {
    		message = this.value;
    		$$invalidate(1, message);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("email" in $$props) $$invalidate(0, email = $$props.email);
    		if ("message" in $$props) $$invalidate(1, message = $$props.message);
    	};

    	return [email, message, sendEmail, input_input_handler, textarea_input_handler];
    }

    class Hireme extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hireme",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/Components/Main/About/About.svelte generated by Svelte v3.18.1 */

    const file$2 = "src/Components/Main/About/About.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let p;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("A propos");
    			t1 = space();
    			p = element("p");
    			p.textContent = "Je suis Souhaila Razfa de El Menzel Sefrou, 23 ans, developpeuse web";
    			attr_dev(i, "class", "icon-account");
    			add_location(i, file$2, 1, 5, 33);
    			add_location(h3, file$2, 1, 1, 29);
    			add_location(p, file$2, 3, 1, 77);
    			attr_dev(div, "class", "section about");
    			add_location(div, file$2, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/Components/Main/Hobby/Hobby.svelte generated by Svelte v3.18.1 */

    const file$3 = "src/Components/Main/Hobby/Hobby.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let span0;
    	let t3;
    	let span1;
    	let t5;
    	let span2;
    	let t7;
    	let span3;
    	let t9;
    	let span4;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Loisirs");
    			t1 = space();
    			span0 = element("span");
    			span0.textContent = "Dessin et arts plastiques";
    			t3 = space();
    			span1 = element("span");
    			span1.textContent = "La peinture";
    			t5 = space();
    			span2 = element("span");
    			span2.textContent = "La lecture";
    			t7 = space();
    			span3 = element("span");
    			span3.textContent = "Apprendre à coder";
    			t9 = space();
    			span4 = element("span");
    			span4.textContent = "Suivre la tendence du web, et de technologie";
    			attr_dev(i, "class", "icon-interests");
    			add_location(i, file$3, 1, 5, 27);
    			add_location(h3, file$3, 1, 1, 23);
    			attr_dev(span0, "class", "tags");
    			add_location(span0, file$3, 3, 1, 73);
    			attr_dev(span1, "class", "tags");
    			add_location(span1, file$3, 4, 1, 126);
    			attr_dev(span2, "class", "tags");
    			add_location(span2, file$3, 5, 1, 165);
    			attr_dev(span3, "class", "tags");
    			add_location(span3, file$3, 6, 1, 203);
    			attr_dev(span4, "class", "tags");
    			add_location(span4, file$3, 7, 1, 248);
    			attr_dev(div, "class", "section");
    			add_location(div, file$3, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, span0);
    			append_dev(div, t3);
    			append_dev(div, span1);
    			append_dev(div, t5);
    			append_dev(div, span2);
    			append_dev(div, t7);
    			append_dev(div, span3);
    			append_dev(div, t9);
    			append_dev(div, span4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Hobby extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Hobby",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/Widgets/Progress.svelte generated by Svelte v3.18.1 */

    const file$4 = "src/Widgets/Progress.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "bar svelte-12j92dc");
    			set_style(div0, "width", /*level*/ ctx[0]);
    			add_location(div0, file$4, 5, 1, 66);
    			attr_dev(div1, "class", "progress-bar svelte-12j92dc");
    			add_location(div1, file$4, 4, 0, 38);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*level*/ 1) {
    				set_style(div0, "width", /*level*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { level } = $$props;
    	const writable_props = ["level"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Progress> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("level" in $$props) $$invalidate(0, level = $$props.level);
    	};

    	$$self.$capture_state = () => {
    		return { level };
    	};

    	$$self.$inject_state = $$props => {
    		if ("level" in $$props) $$invalidate(0, level = $$props.level);
    	};

    	return [level];
    }

    class Progress extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$4, safe_not_equal, { level: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Progress",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*level*/ ctx[0] === undefined && !("level" in props)) {
    			console.warn("<Progress> was created without expected prop 'level'");
    		}
    	}

    	get level() {
    		throw new Error("<Progress>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set level(value) {
    		throw new Error("<Progress>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Components/Main/Language/Language.svelte generated by Svelte v3.18.1 */
    const file$5 = "src/Components/Main/Language/Language.svelte";

    function create_fragment$5(ctx) {
    	let div3;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let div0;
    	let span0;
    	let t3;
    	let t4;
    	let div1;
    	let span1;
    	let t6;
    	let t7;
    	let div2;
    	let span2;
    	let t9;
    	let current;
    	const progress0 = new Progress({ props: { level: "90%" }, $$inline: true });
    	const progress1 = new Progress({ props: { level: "60%" }, $$inline: true });
    	const progress2 = new Progress({ props: { level: "50%" }, $$inline: true });

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Langages");
    			t1 = space();
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Arabe";
    			t3 = space();
    			create_component(progress0.$$.fragment);
    			t4 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "Franàais";
    			t6 = space();
    			create_component(progress1.$$.fragment);
    			t7 = space();
    			div2 = element("div");
    			span2 = element("span");
    			span2.textContent = "Angalais";
    			t9 = space();
    			create_component(progress2.$$.fragment);
    			attr_dev(i, "class", "icon-language");
    			add_location(i, file$5, 5, 5, 113);
    			add_location(h3, file$5, 5, 1, 109);
    			attr_dev(span0, "class", "svelte-100jfut");
    			add_location(span0, file$5, 8, 2, 183);
    			attr_dev(div0, "class", "language svelte-100jfut");
    			add_location(div0, file$5, 7, 1, 158);
    			attr_dev(span1, "class", "svelte-100jfut");
    			add_location(span1, file$5, 13, 2, 265);
    			attr_dev(div1, "class", "language svelte-100jfut");
    			add_location(div1, file$5, 12, 1, 240);
    			attr_dev(span2, "class", "svelte-100jfut");
    			add_location(span2, file$5, 18, 2, 350);
    			attr_dev(div2, "class", "language svelte-100jfut");
    			add_location(div2, file$5, 17, 1, 325);
    			attr_dev(div3, "class", "section language svelte-100jfut");
    			add_location(div3, file$5, 4, 0, 77);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			append_dev(div0, span0);
    			append_dev(div0, t3);
    			mount_component(progress0, div0, null);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div1, span1);
    			append_dev(div1, t6);
    			mount_component(progress1, div1, null);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, span2);
    			append_dev(div2, t9);
    			mount_component(progress2, div2, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(progress0.$$.fragment, local);
    			transition_in(progress1.$$.fragment, local);
    			transition_in(progress2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(progress0.$$.fragment, local);
    			transition_out(progress1.$$.fragment, local);
    			transition_out(progress2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_component(progress0);
    			destroy_component(progress1);
    			destroy_component(progress2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Language extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Language",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/Components/Main/Contact/Contact.svelte generated by Svelte v3.18.1 */

    const file$6 = "src/Components/Main/Contact/Contact.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let h3;
    	let i0;
    	let t0;
    	let t1;
    	let p0;
    	let i1;
    	let t2;
    	let t3;
    	let p1;
    	let i2;
    	let t4;
    	let t5;
    	let p2;
    	let i3;
    	let t6;
    	let t7;
    	let hr;
    	let t8;
    	let a0;
    	let p3;
    	let i4;
    	let t9;
    	let t10;
    	let a1;
    	let p4;
    	let i5;
    	let t11;
    	let t12;
    	let a2;
    	let p5;
    	let i6;
    	let t13;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i0 = element("i");
    			t0 = text("Contact");
    			t1 = space();
    			p0 = element("p");
    			i1 = element("i");
    			t2 = text("Hay amal avenu Abdellah, Senhaji Idrissiya - Casablanca");
    			t3 = space();
    			p1 = element("p");
    			i2 = element("i");
    			t4 = text("razfasouhaila20@gmail.com");
    			t5 = space();
    			p2 = element("p");
    			i3 = element("i");
    			t6 = text("+212 6 30 09 14 66");
    			t7 = space();
    			hr = element("hr");
    			t8 = space();
    			a0 = element("a");
    			p3 = element("p");
    			i4 = element("i");
    			t9 = text("souhaila.razfa");
    			t10 = space();
    			a1 = element("a");
    			p4 = element("p");
    			i5 = element("i");
    			t11 = text("souhaila_razfa");
    			t12 = space();
    			a2 = element("a");
    			p5 = element("p");
    			i6 = element("i");
    			t13 = text("souhaila-razfa");
    			attr_dev(i0, "class", "icon-contact");
    			add_location(i0, file$6, 1, 5, 33);
    			add_location(h3, file$6, 1, 1, 29);
    			attr_dev(i1, "class", "icon-location svelte-1i5v3nw");
    			add_location(i1, file$6, 3, 4, 80);
    			attr_dev(p0, "class", "svelte-1i5v3nw");
    			add_location(p0, file$6, 3, 1, 77);
    			attr_dev(i2, "class", "icon-email svelte-1i5v3nw");
    			add_location(i2, file$6, 4, 4, 173);
    			attr_dev(p1, "class", "svelte-1i5v3nw");
    			add_location(p1, file$6, 4, 1, 170);
    			attr_dev(i3, "class", "icon-phone svelte-1i5v3nw");
    			add_location(i3, file$6, 5, 4, 233);
    			attr_dev(p2, "class", "svelte-1i5v3nw");
    			add_location(p2, file$6, 5, 1, 230);
    			attr_dev(hr, "class", "svelte-1i5v3nw");
    			add_location(hr, file$6, 7, 1, 284);
    			attr_dev(i4, "class", "icon-facebook svelte-1i5v3nw");
    			add_location(i4, file$6, 9, 86, 376);
    			attr_dev(p3, "class", "svelte-1i5v3nw");
    			add_location(p3, file$6, 9, 83, 373);
    			attr_dev(a0, "href", "https://www.facebook.com/profile.php?id=100020406033684");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "class", "svelte-1i5v3nw");
    			add_location(a0, file$6, 9, 1, 291);
    			attr_dev(i5, "class", "icon-instagram svelte-1i5v3nw");
    			add_location(i5, file$6, 10, 71, 499);
    			attr_dev(p4, "class", "svelte-1i5v3nw");
    			add_location(p4, file$6, 10, 68, 496);
    			attr_dev(a1, "href", "https://www.instagram.com/razfasouhaila/");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "svelte-1i5v3nw");
    			add_location(a1, file$6, 10, 1, 429);
    			attr_dev(i6, "class", "icon-linkedin svelte-1i5v3nw");
    			add_location(i6, file$6, 11, 84, 636);
    			attr_dev(p5, "class", "svelte-1i5v3nw");
    			add_location(p5, file$6, 11, 81, 633);
    			attr_dev(a2, "href", "https://www.linkedin.com/in/razfa-souhaila-4997921a1/");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "class", "svelte-1i5v3nw");
    			add_location(a2, file$6, 11, 1, 553);
    			attr_dev(div, "class", "section about");
    			add_location(div, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i0);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, i1);
    			append_dev(p0, t2);
    			append_dev(div, t3);
    			append_dev(div, p1);
    			append_dev(p1, i2);
    			append_dev(p1, t4);
    			append_dev(div, t5);
    			append_dev(div, p2);
    			append_dev(p2, i3);
    			append_dev(p2, t6);
    			append_dev(div, t7);
    			append_dev(div, hr);
    			append_dev(div, t8);
    			append_dev(div, a0);
    			append_dev(a0, p3);
    			append_dev(p3, i4);
    			append_dev(p3, t9);
    			append_dev(div, t10);
    			append_dev(div, a1);
    			append_dev(a1, p4);
    			append_dev(p4, i5);
    			append_dev(p4, t11);
    			append_dev(div, t12);
    			append_dev(div, a2);
    			append_dev(a2, p5);
    			append_dev(p5, i6);
    			append_dev(p5, t13);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Contact extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Contact",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/Components/Main/Experience/Experience.svelte generated by Svelte v3.18.1 */

    const file$7 = "src/Components/Main/Experience/Experience.svelte";

    function create_fragment$7(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let ul;
    	let li0;
    	let h40;
    	let t3;
    	let span0;
    	let t5;
    	let p0;
    	let t7;
    	let li1;
    	let h41;
    	let t9;
    	let span1;
    	let t11;
    	let p1;
    	let t13;
    	let li2;
    	let h42;
    	let t15;
    	let span2;
    	let t17;
    	let p2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Experiences");
    			t1 = space();
    			ul = element("ul");
    			li0 = element("li");
    			h40 = element("h4");
    			h40.textContent = "Stage à DIOINFO - Fés";
    			t3 = space();
    			span0 = element("span");
    			span0.textContent = "01 Séptembre, 30 Séptempbre 2016";
    			t5 = space();
    			p0 = element("p");
    			p0.textContent = "Développement d'un site web de publication des produit pâtissières";
    			t7 = space();
    			li1 = element("li");
    			h41 = element("h4");
    			h41.textContent = "Stage à OCTAGEN - Fés";
    			t9 = space();
    			span1 = element("span");
    			span1.textContent = "01 Août, 30 Août 2016";
    			t11 = space();
    			p1 = element("p");
    			p1.textContent = "Développemebt d'un site web de gestion des offres";
    			t13 = space();
    			li2 = element("li");
    			h42 = element("h4");
    			h42.textContent = "Freelance";
    			t15 = space();
    			span2 = element("span");
    			span2.textContent = "01 Avril, 30 Avril 2016";
    			t17 = space();
    			p2 = element("p");
    			p2.textContent = "Développement d'une application web de gestion des produit artisanal";
    			attr_dev(i, "class", "icon-experience");
    			add_location(i, file$7, 1, 5, 27);
    			add_location(h3, file$7, 1, 1, 23);
    			add_location(h40, file$7, 5, 3, 109);
    			add_location(span0, file$7, 6, 3, 143);
    			add_location(p0, file$7, 7, 3, 192);
    			add_location(li0, file$7, 4, 2, 101);
    			add_location(h41, file$7, 11, 3, 285);
    			add_location(span1, file$7, 12, 3, 319);
    			add_location(p1, file$7, 13, 3, 357);
    			add_location(li1, file$7, 10, 2, 277);
    			add_location(h42, file$7, 17, 3, 433);
    			add_location(span2, file$7, 18, 3, 455);
    			add_location(p2, file$7, 19, 3, 495);
    			add_location(li2, file$7, 16, 2, 425);
    			attr_dev(ul, "class", "timeline");
    			add_location(ul, file$7, 3, 1, 77);
    			attr_dev(div, "class", "section");
    			add_location(div, file$7, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(li0, h40);
    			append_dev(li0, t3);
    			append_dev(li0, span0);
    			append_dev(li0, t5);
    			append_dev(li0, p0);
    			append_dev(ul, t7);
    			append_dev(ul, li1);
    			append_dev(li1, h41);
    			append_dev(li1, t9);
    			append_dev(li1, span1);
    			append_dev(li1, t11);
    			append_dev(li1, p1);
    			append_dev(ul, t13);
    			append_dev(ul, li2);
    			append_dev(li2, h42);
    			append_dev(li2, t15);
    			append_dev(li2, span2);
    			append_dev(li2, t17);
    			append_dev(li2, p2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Experience extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Experience",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/Components/Main/Education/Education.svelte generated by Svelte v3.18.1 */

    const file$8 = "src/Components/Main/Education/Education.svelte";

    function create_fragment$8(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let ul;
    	let li0;
    	let h40;
    	let t3;
    	let span0;
    	let t5;
    	let p0;
    	let t7;
    	let li1;
    	let h41;
    	let t9;
    	let span1;
    	let t11;
    	let p1;
    	let t13;
    	let li2;
    	let h42;
    	let t15;
    	let span2;
    	let t17;
    	let p2;
    	let t19;
    	let li3;
    	let h43;
    	let t21;
    	let span3;
    	let t23;
    	let p3;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Formation");
    			t1 = space();
    			ul = element("ul");
    			li0 = element("li");
    			h40 = element("h4");
    			h40.textContent = "Licence Professionnelle";
    			t3 = space();
    			span0 = element("span");
    			span0.textContent = "2019 - 2020";
    			t5 = space();
    			p0 = element("p");
    			p0.textContent = "Modélisation Statistique Informatique à Université des sciences Hassan II - Casablanca";
    			t7 = space();
    			li1 = element("li");
    			h41 = element("h4");
    			h41.textContent = "DEUP";
    			t9 = space();
    			span1 = element("span");
    			span1.textContent = "2018 - 2019";
    			t11 = space();
    			p1 = element("p");
    			p1.textContent = "Modélisation Statistique Informatique à Université des sciences Hassan II - Casablanca";
    			t13 = space();
    			li2 = element("li");
    			h42 = element("h4");
    			h42.textContent = "Brevet de Technicien Superieurh";
    			t15 = space();
    			span2 = element("span");
    			span2.textContent = "2017, 2018";
    			t17 = space();
    			p2 = element("p");
    			p2.textContent = "Développement des Systemes d'Information au Lycée qualifiant technique, Fés";
    			t19 = space();
    			li3 = element("li");
    			h43 = element("h4");
    			h43.textContent = "Baccalearuat scientifique";
    			t21 = space();
    			span3 = element("span");
    			span3.textContent = "2014, 2015";
    			t23 = space();
    			p3 = element("p");
    			p3.textContent = "Sciences physiques au Lycée Mohamed El Fassi, Fés";
    			attr_dev(i, "class", "icon-formations");
    			add_location(i, file$8, 1, 5, 27);
    			add_location(h3, file$8, 1, 1, 23);
    			add_location(h40, file$8, 5, 3, 107);
    			add_location(span0, file$8, 6, 3, 143);
    			add_location(p0, file$8, 7, 3, 171);
    			add_location(li0, file$8, 4, 2, 99);
    			add_location(h41, file$8, 11, 3, 284);
    			add_location(span1, file$8, 12, 3, 301);
    			add_location(p1, file$8, 13, 3, 329);
    			add_location(li1, file$8, 10, 2, 276);
    			add_location(h42, file$8, 17, 3, 442);
    			add_location(span2, file$8, 18, 3, 486);
    			add_location(p2, file$8, 19, 3, 513);
    			add_location(li2, file$8, 16, 2, 434);
    			add_location(h43, file$8, 23, 3, 615);
    			add_location(span3, file$8, 24, 3, 653);
    			add_location(p3, file$8, 25, 3, 680);
    			add_location(li3, file$8, 22, 2, 607);
    			attr_dev(ul, "class", "timeline");
    			add_location(ul, file$8, 3, 1, 75);
    			attr_dev(div, "class", "section");
    			add_location(div, file$8, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, ul);
    			append_dev(ul, li0);
    			append_dev(li0, h40);
    			append_dev(li0, t3);
    			append_dev(li0, span0);
    			append_dev(li0, t5);
    			append_dev(li0, p0);
    			append_dev(ul, t7);
    			append_dev(ul, li1);
    			append_dev(li1, h41);
    			append_dev(li1, t9);
    			append_dev(li1, span1);
    			append_dev(li1, t11);
    			append_dev(li1, p1);
    			append_dev(ul, t13);
    			append_dev(ul, li2);
    			append_dev(li2, h42);
    			append_dev(li2, t15);
    			append_dev(li2, span2);
    			append_dev(li2, t17);
    			append_dev(li2, p2);
    			append_dev(ul, t19);
    			append_dev(ul, li3);
    			append_dev(li3, h43);
    			append_dev(li3, t21);
    			append_dev(li3, span3);
    			append_dev(li3, t23);
    			append_dev(li3, p3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Education extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Education",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/Components/Main/Skills/Skills.svelte generated by Svelte v3.18.1 */

    const file$9 = "src/Components/Main/Skills/Skills.svelte";

    function create_fragment$9(ctx) {
    	let div;
    	let h3;
    	let i;
    	let t0;
    	let t1;
    	let h40;
    	let t3;
    	let span0;
    	let t5;
    	let span1;
    	let t7;
    	let span2;
    	let t9;
    	let span3;
    	let t11;
    	let span4;
    	let t13;
    	let span5;
    	let t15;
    	let span6;
    	let t17;
    	let span7;
    	let t19;
    	let span8;
    	let t21;
    	let h41;
    	let t23;
    	let span9;
    	let t25;
    	let span10;
    	let t27;
    	let span11;
    	let t29;
    	let h42;
    	let t31;
    	let span12;
    	let t33;
    	let span13;
    	let t35;
    	let span14;
    	let t37;
    	let span15;
    	let t39;
    	let span16;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			i = element("i");
    			t0 = text("Compétences");
    			t1 = space();
    			h40 = element("h4");
    			h40.textContent = "Web development";
    			t3 = space();
    			span0 = element("span");
    			span0.textContent = "HTML";
    			t5 = space();
    			span1 = element("span");
    			span1.textContent = "CSS";
    			t7 = space();
    			span2 = element("span");
    			span2.textContent = "Bootstrap Css";
    			t9 = space();
    			span3 = element("span");
    			span3.textContent = "JavaScript";
    			t11 = space();
    			span4 = element("span");
    			span4.textContent = "jQuery";
    			t13 = space();
    			span5 = element("span");
    			span5.textContent = "Vue Js";
    			t15 = space();
    			span6 = element("span");
    			span6.textContent = "PHP";
    			t17 = space();
    			span7 = element("span");
    			span7.textContent = "Laravel";
    			t19 = space();
    			span8 = element("span");
    			span8.textContent = "MySQL";
    			t21 = space();
    			h41 = element("h4");
    			h41.textContent = "Softwares";
    			t23 = space();
    			span9 = element("span");
    			span9.textContent = "Windows 10";
    			t25 = space();
    			span10 = element("span");
    			span10.textContent = "Microsoft Office";
    			t27 = space();
    			span11 = element("span");
    			span11.textContent = "Matlab";
    			t29 = space();
    			h42 = element("h4");
    			h42.textContent = "Autre compétences";
    			t31 = space();
    			span12 = element("span");
    			span12.textContent = "Langage R";
    			t33 = space();
    			span13 = element("span");
    			span13.textContent = "Modélisation et Test Statistiques";
    			t35 = space();
    			span14 = element("span");
    			span14.textContent = "UML";
    			t37 = space();
    			span15 = element("span");
    			span15.textContent = "SPSS";
    			t39 = space();
    			span16 = element("span");
    			span16.textContent = "Java";
    			attr_dev(i, "class", "icon-skills");
    			add_location(i, file$9, 1, 5, 36);
    			add_location(h3, file$9, 1, 1, 32);
    			attr_dev(h40, "class", "svelte-1kl46i7");
    			add_location(h40, file$9, 3, 1, 82);
    			attr_dev(span0, "class", "tags");
    			add_location(span0, file$9, 4, 1, 108);
    			attr_dev(span1, "class", "tags");
    			add_location(span1, file$9, 5, 1, 140);
    			attr_dev(span2, "class", "tags");
    			add_location(span2, file$9, 6, 1, 171);
    			attr_dev(span3, "class", "tags");
    			add_location(span3, file$9, 7, 1, 212);
    			attr_dev(span4, "class", "tags");
    			add_location(span4, file$9, 8, 1, 250);
    			attr_dev(span5, "class", "tags");
    			add_location(span5, file$9, 9, 1, 284);
    			attr_dev(span6, "class", "tags");
    			add_location(span6, file$9, 10, 1, 318);
    			attr_dev(span7, "class", "tags");
    			add_location(span7, file$9, 11, 1, 349);
    			attr_dev(span8, "class", "tags");
    			add_location(span8, file$9, 12, 1, 384);
    			attr_dev(h41, "class", "svelte-1kl46i7");
    			add_location(h41, file$9, 14, 1, 418);
    			attr_dev(span9, "class", "tags");
    			add_location(span9, file$9, 15, 1, 438);
    			attr_dev(span10, "class", "tags");
    			add_location(span10, file$9, 16, 1, 476);
    			attr_dev(span11, "class", "tags");
    			add_location(span11, file$9, 17, 1, 520);
    			attr_dev(h42, "class", "svelte-1kl46i7");
    			add_location(h42, file$9, 19, 1, 555);
    			attr_dev(span12, "class", "tags");
    			add_location(span12, file$9, 20, 1, 583);
    			attr_dev(span13, "class", "tags");
    			add_location(span13, file$9, 21, 1, 620);
    			attr_dev(span14, "class", "tags");
    			add_location(span14, file$9, 22, 1, 681);
    			attr_dev(span15, "class", "tags");
    			add_location(span15, file$9, 23, 1, 712);
    			attr_dev(span16, "class", "tags");
    			add_location(span16, file$9, 24, 1, 744);
    			attr_dev(div, "class", "section language");
    			add_location(div, file$9, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(h3, i);
    			append_dev(h3, t0);
    			append_dev(div, t1);
    			append_dev(div, h40);
    			append_dev(div, t3);
    			append_dev(div, span0);
    			append_dev(div, t5);
    			append_dev(div, span1);
    			append_dev(div, t7);
    			append_dev(div, span2);
    			append_dev(div, t9);
    			append_dev(div, span3);
    			append_dev(div, t11);
    			append_dev(div, span4);
    			append_dev(div, t13);
    			append_dev(div, span5);
    			append_dev(div, t15);
    			append_dev(div, span6);
    			append_dev(div, t17);
    			append_dev(div, span7);
    			append_dev(div, t19);
    			append_dev(div, span8);
    			append_dev(div, t21);
    			append_dev(div, h41);
    			append_dev(div, t23);
    			append_dev(div, span9);
    			append_dev(div, t25);
    			append_dev(div, span10);
    			append_dev(div, t27);
    			append_dev(div, span11);
    			append_dev(div, t29);
    			append_dev(div, h42);
    			append_dev(div, t31);
    			append_dev(div, span12);
    			append_dev(div, t33);
    			append_dev(div, span13);
    			append_dev(div, t35);
    			append_dev(div, span14);
    			append_dev(div, t37);
    			append_dev(div, span15);
    			append_dev(div, t39);
    			append_dev(div, span16);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Skills extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Skills",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/Components/Footer/Footer.svelte generated by Svelte v3.18.1 */

    const file$a = "src/Components/Footer/Footer.svelte";

    function create_fragment$a(ctx) {
    	let footer;
    	let p;
    	let t0;
    	let strong;
    	let t2;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			p = element("p");
    			t0 = text("Designed and Developed by ");
    			strong = element("strong");
    			strong.textContent = "Youness Boualam";
    			t2 = text(" using Svelte Js");
    			attr_dev(strong, "class", "svelte-h6ee2");
    			add_location(strong, file$a, 1, 30, 39);
    			add_location(p, file$a, 1, 1, 10);
    			attr_dev(footer, "class", "svelte-h6ee2");
    			add_location(footer, file$a, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, p);
    			append_dev(p, t0);
    			append_dev(p, strong);
    			append_dev(p, t2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src/Yunex.svelte generated by Svelte v3.18.1 */
    const file$b = "src/Yunex.svelte";

    function create_fragment$b(ctx) {
    	let t0;
    	let main;
    	let div0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let div1;
    	let t6;
    	let t7;
    	let t8;
    	let current;
    	const header = new Header({ $$inline: true });
    	const hireme = new Hireme({ $$inline: true });
    	const about = new About({ $$inline: true });
    	const language = new Language({ $$inline: true });
    	const hobby = new Hobby({ $$inline: true });
    	const contact = new Contact({ $$inline: true });
    	const experience = new Experience({ $$inline: true });
    	const education = new Education({ $$inline: true });
    	const skills = new Skills({ $$inline: true });
    	const footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			div0 = element("div");
    			create_component(hireme.$$.fragment);
    			t1 = space();
    			create_component(about.$$.fragment);
    			t2 = space();
    			create_component(language.$$.fragment);
    			t3 = space();
    			create_component(hobby.$$.fragment);
    			t4 = space();
    			create_component(contact.$$.fragment);
    			t5 = space();
    			div1 = element("div");
    			create_component(experience.$$.fragment);
    			t6 = space();
    			create_component(education.$$.fragment);
    			t7 = space();
    			create_component(skills.$$.fragment);
    			t8 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(div0, "class", "left svelte-1sxfvvh");
    			add_location(div0, file$b, 19, 1, 739);
    			attr_dev(div1, "class", "right svelte-1sxfvvh");
    			add_location(div1, file$b, 26, 1, 833);
    			attr_dev(main, "class", "svelte-1sxfvvh");
    			add_location(main, file$b, 18, 0, 731);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			mount_component(hireme, div0, null);
    			append_dev(div0, t1);
    			mount_component(about, div0, null);
    			append_dev(div0, t2);
    			mount_component(language, div0, null);
    			append_dev(div0, t3);
    			mount_component(hobby, div0, null);
    			append_dev(div0, t4);
    			mount_component(contact, div0, null);
    			append_dev(main, t5);
    			append_dev(main, div1);
    			mount_component(experience, div1, null);
    			append_dev(div1, t6);
    			mount_component(education, div1, null);
    			append_dev(div1, t7);
    			mount_component(skills, div1, null);
    			insert_dev(target, t8, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(hireme.$$.fragment, local);
    			transition_in(about.$$.fragment, local);
    			transition_in(language.$$.fragment, local);
    			transition_in(hobby.$$.fragment, local);
    			transition_in(contact.$$.fragment, local);
    			transition_in(experience.$$.fragment, local);
    			transition_in(education.$$.fragment, local);
    			transition_in(skills.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(hireme.$$.fragment, local);
    			transition_out(about.$$.fragment, local);
    			transition_out(language.$$.fragment, local);
    			transition_out(hobby.$$.fragment, local);
    			transition_out(contact.$$.fragment, local);
    			transition_out(experience.$$.fragment, local);
    			transition_out(education.$$.fragment, local);
    			transition_out(skills.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			destroy_component(hireme);
    			destroy_component(about);
    			destroy_component(language);
    			destroy_component(hobby);
    			destroy_component(contact);
    			destroy_component(experience);
    			destroy_component(education);
    			destroy_component(skills);
    			if (detaching) detach_dev(t8);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Yunex extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Yunex",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    const yunex = new Yunex({
    	target: document.body
    });

    return yunex;

}());
//# sourceMappingURL=app.js.map
