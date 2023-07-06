// JALANGI DO NOT INSTRUMENT

namespace Jalangi.Yuantijs {
  (function (J$: JalangiContext) {
    const global = window;

    const trackingResult: TrackingResult = {
      flowCollection: [],
      storageLabelCollection: [],
    };

    function __ytjs_getTrackingResult(): CompactTrackingResult {
      function simplifyTaint(taint: Taint): Label[] {
        const labelSet = new Set<Label>();
        const visitQueue = [taint];
        const visitedTaintSet = new WeakSet<Taint>();
        while (visitQueue.length > 0) {
          const currentTaint = visitQueue.pop()!;
          if (visitedTaintSet.has(currentTaint)) continue;
          visitedTaintSet.add(currentTaint);
          if (isBaseTaint(currentTaint)) {
            labelSet.add(currentTaint.label);
          } else if (isJoinTaint(currentTaint)) {
            visitQueue.push(currentTaint.l, currentTaint.r);
          }
        }
        return [...labelSet];
      }

      const labelSet = new Set<Label>();
      function registerLabel(label: Label): LabelMapKey {
        return labelSet.add(label), label.id;
      }

      const compactFlowCollection: CompactFlow[] =
        trackingResult.flowCollection.map<CompactFlow>((flow) => ({
          taint: simplifyTaint(flow.taint).map((label) => registerLabel(label)),
          sinkLabel: registerLabel(flow.sinkLabel),
        }));

      const compactStorageLabelCollection: LabelMapKey[] =
        trackingResult.storageLabelCollection.map<LabelMapKey>((label) =>
          registerLabel(label)
        );

      const labelMap: LabelMap = Object.fromEntries(
        [...labelSet].map<[LabelMapKey, Label]>((label) => [label.id, label])
      );

      return {
        labelMap,
        flowCollection: compactFlowCollection,
        storageLabelCollection: compactStorageLabelCollection,
      };
    }
    global.__ytjs_getTrackingResult = __ytjs_getTrackingResult;

    function collectFlow(taint: Taint, sinkLabel: Label): void {
      if (isBottom(taint)) return;
      trackingResult.flowCollection.push({ taint, sinkLabel });
    }

    function collectStorageLabel(label: Label): void {
      trackingResult.storageLabelCollection.push(label);
    }

    const isNaN = global.isNaN;

    const Reflect_defineProperty = global.Reflect.defineProperty;
    const Reflect_getOwnPropertyDescriptor =
      global.Reflect.getOwnPropertyDescriptor;
    const Reflect_getPrototypeOf = global.Reflect.getPrototypeOf;
    const Reflect_ownKeys = global.Reflect.ownKeys;
    const Reflect_setPrototypeOf = global.Reflect.setPrototypeOf;

    const Object_prototype = global.Object.prototype;
    const Array_prototype = global.Array.prototype;

    const Storage_prototype_getItem = global.Storage.prototype.getItem;
    const Storage_prototype_setItem = global.Storage.prototype.setItem;
    const localStorage = global.localStorage;
    const sessionStorage = global.sessionStorage;
    const document = global.document;
    const location = global.location;
    const navigator = global.navigator;
    const navigator_sendBeacon = global.navigator.sendBeacon;
    const XMLHttpRequest_prototype = global.XMLHttpRequest.prototype;
    const XMLHttpRequest_prototype_open = global.XMLHttpRequest.prototype.open;
    const XMLHttpRequest_prototype_send = global.XMLHttpRequest.prototype.send;
    const fetch = global.fetch;
    const HTMLElement = global.HTMLElement;

    const Promise = global.Promise;
    const Promise_prototype = global.Promise.prototype;
    const Promise_prototype_then = global.Promise.prototype.then;

    function Location(iid: number, sid?: number): Location {
      sid = sid || J$.sid;
      const entry = J$.smap[sid];
      if (entry) {
        return {
          iid,
          sid,
          url: entry.url || "null",
          loc: entry[iid],
          sub:
            entry.evalIid && entry.evalSid
              ? Location(entry.evalIid, entry.evalSid)
              : null,
        };
      } else {
        throw new Error("Entry not found in script map");
      }
    }

    function getScriptUrl(sid?: number) {
      sid = sid || J$.sid;
      const entry = J$.smap[sid];
      if (entry) {
        return entry.url || "null";
      } else {
        throw new Error("Entry not found in script map");
      }
    }

    let freshLabelId: number = 1;

    function Label(
      type: string,
      location: Location,
      info: object | null
    ): Label {
      return { id: freshLabelId++, type, location, info };
    }

    function Taint(label: Label): Taint {
      return { type: "base", label } as BaseTaint;
    }

    const BOTTOM: Taint = { type: "bottom" } as Bottom;

    function join(l: Taint, r: Taint): Taint {
      if (l === BOTTOM) {
        return r;
      } else if (r === BOTTOM) {
        return l;
      }
      return { type: "join", l, r } as JoinTaint;
    }

    function isBottom(taint: Taint): taint is Bottom {
      return taint.type === "bottom";
    }

    function isBaseTaint(taint: Taint): taint is BaseTaint {
      return taint.type === "base";
    }

    function isJoinTaint(taint: Taint): taint is JoinTaint {
      return taint.type === "join";
    }

    function isObject(value: any): value is object {
      return (
        (typeof value === "object" && value !== null) ||
        typeof value === "function"
      );
    }

    function isFunction(value: any): value is Function {
      return typeof value === "function";
    }

    function findPropertyOwner(
      object: object | null,
      key: PropertyKey
    ): { object: object; descriptor: PropertyDescriptor } | null {
      let descriptor: PropertyDescriptor | undefined;
      for (
        ;
        object && !(descriptor = Reflect_getOwnPropertyDescriptor(object, key));
        object = Reflect_getPrototypeOf(object)
      );
      if (object) {
        return { object: object, descriptor: descriptor! };
      } else {
        return null;
      }
    }

    function toShadowName(name: string): string;
    function toShadowName(name: PropertyKey): PropertyKey;

    function toShadowName(name: unknown): unknown {
      return typeof name === "symbol" ? name : "$" + name;
    }

    const INTRINSIC = Symbol();

    interface UserFunctionMeta {
      env: Environment;
    }

    class Memory {
      shadowMap: WeakMap<object, Record<PropertyKey, Taint>>;
      userFunctionMap: WeakMap<Function, UserFunctionMeta>;

      constructor() {
        this.shadowMap = new WeakMap();
        this.userFunctionMap = new WeakMap();
      }

      getShadow(object: object): Record<PropertyKey, Taint> | null {
        return this.shadowMap.get(object) || null;
      }

      getOrCreateShadow(object: object): Record<PropertyKey, Taint> {
        let shadow = this.shadowMap.get(object);
        if (!shadow) {
          this.shadowMap.set(object, (shadow = {}));
        }
        return shadow;
      }

      get(target: any, key: PropertyKey): Taint {
        if (!isObject(target)) {
          return BOTTOM;
        }
        const ownerInfo = findPropertyOwner(target, key);
        if (ownerInfo) {
          const descriptor = ownerInfo.descriptor;
          if (descriptor.get && descriptor.set) {
            return BOTTOM;
          } else {
            return this.getOwn(ownerInfo.object, key);
          }
        } else {
          return BOTTOM;
        }
      }

      getOwn(targetObj: object, key: PropertyKey): Taint {
        const shadow = this.getShadow(targetObj);
        if (!shadow) {
          return BOTTOM;
        }
        if (this.isUserObject(targetObj)) {
          return shadow[toShadowName(key)] || BOTTOM;
        } else {
          return shadow[INTRINSIC] || BOTTOM;
        }
      }

      set(target: any, key: PropertyKey, taint: Taint): boolean {
        if (!isObject(target)) {
          return true;
        }
        const ownerInfo = findPropertyOwner(target, key);
        if (ownerInfo) {
          const descriptor = ownerInfo.descriptor;
          if (descriptor.get || descriptor.set) {
            return true;
          } else if (!descriptor.writable) {
            return false;
          } else {
            return this.setOwn(target, key, taint);
          }
        } else {
          return this.setOwn(target, key, taint);
        }
      }

      setOwn(targetObj: object, key: PropertyKey, taint: Taint): boolean {
        const shadow = this.getOrCreateShadow(targetObj);
        if (this.isUserObject(targetObj)) {
          shadow[toShadowName(key)] = taint;
        } else {
          shadow[INTRINSIC] = join(shadow[INTRINSIC] || BOTTOM, taint);
        }
        return true;
      }

      delete(target: any, key: PropertyKey): boolean {
        if (!isObject(target)) {
          return true;
        }
        const descriptor = Reflect_getOwnPropertyDescriptor(target, key);
        if (descriptor) {
          if (descriptor.configurable) {
            const shadow = this.getShadow(target);
            if (shadow) {
              delete shadow[toShadowName(key)];
            }
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      }

      getIntrinsic(target: any): Taint {
        if (!isObject(target)) {
          return BOTTOM;
        }
        const shadow = this.getShadow(target);
        if (!shadow) {
          return BOTTOM;
        }
        if (this.isUserObject(target)) {
          let taint = BOTTOM;
          const keys = Reflect_ownKeys(target);
          for (let i = 0; i < keys.length; ++i) {
            taint = join(taint, shadow[toShadowName(keys[i])] || BOTTOM);
          }
          return taint;
        } else {
          return shadow[INTRINSIC] || BOTTOM;
        }
      }

      updateIntrinsic(target: any, taint: Taint): boolean {
        if (!isObject(target)) {
          return true;
        }
        if (taint === BOTTOM) {
          return true;
        }
        const shadow = this.getOrCreateShadow(target);
        if (this.isUserObject(target)) {
          const keys = Reflect_ownKeys(target);
          for (let i = 0; i < keys.length; ++i) {
            const $key = toShadowName(keys[i]);
            shadow[$key] = join(shadow[$key] || BOTTOM, taint);
          }
          return true;
        } else {
          shadow[INTRINSIC] = join(shadow[INTRINSIC] || BOTTOM, taint);
          return true;
        }
      }

      isUserObject(targetObj: object): boolean {
        if (targetObj === global) {
          return true;
        } else {
          const prototype = Reflect_getPrototypeOf(targetObj);
          return (
            !prototype ||
            prototype === Object_prototype ||
            prototype === Array_prototype ||
            (prototype.constructor &&
              this.userFunctionMap.has(prototype.constructor))
          );
        }
      }

      addUserFunction(f: Function, meta: UserFunctionMeta): void {
        this.userFunctionMap.set(f, meta);
      }

      isUserFunction(f: Function): boolean {
        return this.userFunctionMap.has(f);
      }

      getUserFunctionMeta(f: Function): UserFunctionMeta | undefined {
        return this.userFunctionMap.get(f);
      }
    }

    const memory = new Memory();

    interface Environment {
      get(identifier: string): Taint;
      set(identifier: string, taint: Taint): void;
      declareVariable(identifier: string, taint: Taint): void;
      initArguments(args: any[]): void;
      declareArgument(identifier: string, index: number): void;
    }

    class FunctionEnvironment implements Environment {
      foreignEnv: Environment;
      bindings: Record<string, Taint>;
      store: Record<string, Taint>;
      args: any[] | null;

      constructor(parentEnv: Environment) {
        if (parentEnv instanceof FunctionEnvironment) {
          this.foreignEnv = parentEnv.foreignEnv;
          Reflect_setPrototypeOf((this.bindings = {}), null);
        } else {
          this.foreignEnv = parentEnv;
          Reflect_setPrototypeOf((this.bindings = {}), null);
        }
        this.store = {};
        this.args = null;
      }

      get(identifier: string) {
        return (
          this.bindings[toShadowName(identifier)] ||
          this.foreignEnv.get(identifier)
        );
      }

      set(identifier: string, taint: Taint): void {
        const $identifier = toShadowName(identifier);
        if ($identifier in this.bindings) {
          this.bindings[$identifier] = taint;
        } else {
          this.foreignEnv.set(identifier, taint);
        }
      }

      declareVariable(identifier: string, taint: Taint): void {
        const $identifier = toShadowName(identifier);
        this.store[$identifier] = taint;
        const thisEnv = this;
        Reflect_defineProperty(this.bindings, $identifier, {
          configurable: true,
          enumerable: true,
          get: function () {
            return thisEnv.store[$identifier];
          },
          set: function (taint) {
            thisEnv.store[$identifier] = taint;
          },
        });
      }

      initArguments(args: any[]): void {
        this.args = args;
        this.declareVariable("arguments", BOTTOM);
      }

      declareArgument(identifier: string, index: number): void {
        if (!this.args) {
          throw new Error(
            "Declaring argument, but arguments has not been initialized"
          );
        }
        const thisEnv = this;
        Reflect_defineProperty(this.bindings, toShadowName(identifier), {
          configurable: true,
          enumerable: true,
          get: function () {
            return memory.get(thisEnv.args, "" + index);
          },
          set: function (taint) {
            memory.set(thisEnv.args, "" + index, taint);
          },
        });
      }
    }

    class GlobalEnvironment implements Environment {
      get(identifier: string): Taint {
        return memory.get(global, identifier);
      }

      set(identifier: string, taint: Taint): void {
        memory.set(global, identifier, taint);
      }

      declareVariable(identifier: string, taint: Taint): void {
        memory.set(global, identifier, taint);
      }

      initArguments(args: any[]): void {
        throw new Error("Initializing arguments in global environment");
      }

      declareArgument(identifier: string, index: number): void {
        throw new Error("Declaring argument in global environment");
      }
    }

    class Frame {
      stack: Taint[];
      env: Environment;
      ctx: Context;
      calleeCtx: Context;
      retTaint: Taint;

      constructor(env: Environment, ctx: Context) {
        this.stack = [];
        this.env = env;
        this.ctx = ctx;
        this.calleeCtx = BOTTOM_CONTEXT;
        this.retTaint = BOTTOM;
      }

      setCalleeContext(ctx: Context): void {
        this.calleeCtx = ctx;
      }

      resetCalleeContext(): void {
        this.calleeCtx = BOTTOM_CONTEXT;
      }
    }

    class YuantijsAnalysis implements JalangiAnalysis {
      frameStack: Frame[];
      currentFrame: Frame;
      excTaint: Taint;
      auxTaint: Taint;
      readWithStmtObject: object | null;

      constructor() {
        this.frameStack = [];
        this.currentFrame = new Frame(
          new GlobalEnvironment(),
          new UserFunctionContext(BOTTOM, [])
        );
        this.excTaint = BOTTOM;
        this.auxTaint = BOTTOM;
        this.readWithStmtObject = null;

        const thisAnalysis = this;

        const defaultLast = J$._;
        J$._ = function () {
          thisAnalysis.last();
          return defaultLast();
        };

        _setupTrackablePromise(this);
      }

      push(taint: Taint): void {
        this.currentFrame.stack.push(taint);
      }

      peek(): Taint {
        return this.currentFrame.stack.at(-1)!;
      }

      take(): Taint {
        return this.currentFrame.stack.pop()!;
      }

      takeMany(takeLength: number): Taint[] {
        return takeLength > 0
          ? this.currentFrame.stack.splice(-takeLength)
          : [];
      }

      remove(): void {
        --this.currentFrame.stack.length;
      }

      removeMany(removeLength: number): void {
        this.currentFrame.stack.length -= removeLength;
      }

      isObjectLiteral(value: any): value is object {
        if (isObject(value)) {
          const prototype = Reflect_getPrototypeOf(value);
          return (
            !prototype ||
            prototype === Object_prototype ||
            (prototype.constructor &&
              memory.isUserFunction(prototype.constructor))
          );
        } else {
          return false;
        }
      }

      isArrayLiteral(value: any): value is any[] {
        return (
          isObject(value) && Reflect_getPrototypeOf(value) === Array_prototype
        );
      }

      initObjectLiteral(target: object): void {
        const keys = Reflect_ownKeys(target);
        const dataKeys = [];
        let getterSetterCount = 0;
        let hasNumericKey = false;
        for (let i = 0; i < keys.length; ++i) {
          const key = keys[i];
          const descriptor = Reflect_getOwnPropertyDescriptor(target, key)!;
          if (descriptor.get || descriptor.set) {
            if (descriptor.get && descriptor.set) {
              getterSetterCount += 2;
            } else {
              getterSetterCount += 1;
            }
          } else {
            dataKeys[dataKeys.length] = key;
          }
          if (!isNaN(+(key as string))) {
            hasNumericKey = true;
          }
        }
        this.removeMany(getterSetterCount);
        let overridesPrototype =
          Reflect_getPrototypeOf(target) !== Object_prototype;
        if (hasNumericKey || overridesPrototype) {
          let taint = BOTTOM;
          for (
            let i = dataKeys.length + (overridesPrototype ? 1 : 0) - 1;
            i >= 0;
            --i
          ) {
            taint = join(this.take(), taint);
          }
          for (let i = dataKeys.length - 1; i >= 0; --i) {
            memory.setOwn(target, dataKeys[i], taint);
          }
        } else {
          for (let i = dataKeys.length - 1; i >= 0; --i) {
            memory.setOwn(target, dataKeys[i], this.take());
          }
        }
      }

      initArrayLiteral(target: any[]): void {
        const keys = Reflect_ownKeys(target);
        for (let i = keys.length - 2; i >= 0; --i) {
          memory.setOwn(target, keys[i], this.take());
        }
      }

      initFunctionLiteral(target: Function): void {
        memory.addUserFunction(target, { env: this.currentFrame.env });
      }

      invokeFunPre(
        iid: number,
        f: Function,
        base: any,
        args: any[],
        isConstructor: boolean,
        isMethod: boolean,
        functionIid: boolean,
        functionSid: boolean
      ): void {
        let argsTaint = this.takeMany(args.length);
        this.remove();
        let baseTaint = BOTTOM;
        if (isMethod) {
          baseTaint = this.take();
        }
        if (memory.isUserFunction(f)) {
          this.currentFrame.setCalleeContext(
            new UserFunctionContext(baseTaint, argsTaint)
          );
        } else {
          invokeFunAsSink(iid, f, base, baseTaint, args, argsTaint);
          let inputTaint = isObject(base)
            ? memory.getIntrinsic(base)
            : baseTaint;
          for (let i = 0; i < args.length; ++i) {
            inputTaint = join(
              inputTaint,
              isObject(args[i]) ? memory.getIntrinsic(args[i]) : argsTaint[i]
            );
          }
          this.currentFrame.setCalleeContext(
            new NativeFunctionContext(inputTaint)
          );
        }
      }

      invokeFun(
        iid: number,
        f: Function,
        base: any,
        args: any[],
        result: any,
        isConstructor: boolean,
        isMethod: boolean,
        functionIid: boolean,
        functionSid: boolean
      ): void {
        this.push(
          this.currentFrame.calleeCtx.apply(
            result,
            invokeFunAsSource(iid, f, base, args, result)
          )
        );
        this.currentFrame.resetCalleeContext();
      }

      literal(iid: number, val: any, hasGetterSetter: boolean): void {
        if (isFunction(val)) {
          this.initFunctionLiteral(val);
        } else if (this.isObjectLiteral(val)) {
          this.initObjectLiteral(val);
        } else if (this.isArrayLiteral(val)) {
          this.initArrayLiteral(val);
        }
        this.push(BOTTOM);
      }

      forinObject(iid: number, val: object): void {
        this.remove();
      }

      declare(
        iid: number,
        name: string,
        val: any,
        isArgument: boolean,
        argumentIndex: number,
        isCatchParam: boolean
      ): void {
        if (isArgument) {
          if (argumentIndex === -1) {
            for (let i = 0; i < val.length; ++i) {
              memory.setOwn(
                val,
                "" + i,
                this.currentFrame.ctx.getCalleeArgument(i, val[i])
              );
            }
            this.currentFrame.env.initArguments(val);
          } else {
            this.currentFrame.env.declareArgument(name, argumentIndex);
          }
        } else if (isCatchParam) {
          this.currentFrame.env.declareVariable(name, this.excTaint);
          this.currentFrame.resetCalleeContext();
          this.currentFrame.stack.length = 0;
          this.excTaint = BOTTOM;
        } else {
          this.currentFrame.stack.length = 0;
          this.currentFrame.env.declareVariable(name, BOTTOM);
        }
      }

      getFieldPre(
        iid: number,
        base: any,
        offset: any,
        isComputed: boolean,
        isOpAssign: boolean,
        isMethodCall: boolean
      ): void {
        let baseTaint;
        let offsetTaint = BOTTOM;
        if (isComputed) {
          offsetTaint = this.take();
        }
        baseTaint = this.take();
        this.currentFrame.setCalleeContext(
          new GetFieldContext(baseTaint, memory.get(base, offset))
        );
        if (isOpAssign) {
          this.push(baseTaint);
          if (isComputed) {
            this.push(offsetTaint);
          }
        } else if (isMethodCall) {
          this.push(baseTaint);
        }
      }

      getField(
        iid: number,
        base: any,
        offset: any,
        val: any,
        isComputed: boolean,
        isOpAssign: boolean,
        isMethodCall: boolean
      ): void {
        this.push(
          this.currentFrame.calleeCtx.apply(
            val,
            getFieldAsSource(iid, base, offset, val)
          )
        );
        this.currentFrame.resetCalleeContext();
      }

      putFieldPre(
        iid: number,
        base: any,
        offset: any,
        val: any,
        isComputed: boolean,
        isOpAssign: boolean
      ): void {
        if (this.currentFrame.stack.length < (isComputed ? 3 : 2)) {
          this.push(BOTTOM); // ugly hack for for..in loop
        }
        let valTaint = this.take();
        let offsetTaint = BOTTOM;
        if (isComputed) {
          offsetTaint = this.take();
        }
        let baseTaint = this.take();
        this.push(valTaint);
        putFieldAsSink(iid, base, offset, val, valTaint);
        this.currentFrame.setCalleeContext(
          new PutFieldContext(baseTaint, valTaint)
        );
      }

      putField(
        iid: number,
        base: any,
        offset: any,
        val: any,
        isComputed: boolean,
        isOpAssign: boolean
      ): void {
        memory.set(base, offset, this.currentFrame.calleeCtx.apply(val));
        this.currentFrame.resetCalleeContext();
      }

      read(
        iid: number,
        name: string,
        val: any,
        isGlobal: boolean,
        isScriptLocal: boolean
      ): void {
        if (name === "this") {
          this.push(this.currentFrame.ctx.getCalleeThis(val));
        } else if (this.readWithStmtObject) {
          this.push(memory.get(this.readWithStmtObject, name));
          this.readWithStmtObject = null;
        } else {
          this.push(this.currentFrame.env.get(name));
        }
      }

      write(
        iid: number,
        name: string,
        val: any,
        lhs: any,
        isGlobal: boolean,
        isScriptLocal: boolean
      ): void {
        if (this.currentFrame.stack.length < 1) {
          this.push(BOTTOM); // ugly hack for for..in loop
        }
        if (this.readWithStmtObject) {
          memory.set(this.readWithStmtObject, name, this.peek());
          this.readWithStmtObject = null;
        } else {
          this.currentFrame.env.set(name, this.peek());
        }
      }

      _return(iid: number, val: any): void {
        if (this.currentFrame.stack.length < 1) {
          this.push(BOTTOM); // ugly hack for return statement with no value
        }
        this.currentFrame.retTaint = this.peek();
      }

      _throw(iid: number, val: any): void {
        this.excTaint = this.peek();
      }

      _with(iid: number, val: any): { result: object } | undefined {
        this.remove();
        const thisAnalysis = this;
        return {
          result: new Proxy(val, {
            get(target, key) {
              thisAnalysis.readWithStmtObject = val;
              return target[key];
            },
          }),
        };
      }

      functionEnter(iid: number, f: Function, thisVal: any, args: any[]): void {
        const oldCurrentFrame = this.currentFrame;
        this.frameStack[this.frameStack.length] = oldCurrentFrame;
        this.currentFrame = new Frame(
          new FunctionEnvironment(memory.getUserFunctionMeta(f)!.env),
          oldCurrentFrame.calleeCtx
        );
        this.currentFrame.ctx.enterCallee(thisVal, args);
      }

      functionExit(
        iid: number,
        returnVal: any,
        wrappedExceptionVal: { exception: any } | undefined
      ): void {
        if (!wrappedExceptionVal) {
          this.currentFrame.ctx.leaveCallee(
            returnVal,
            this.currentFrame.retTaint
          );
        }
        this.currentFrame = this.frameStack[this.frameStack.length - 1];
        --this.frameStack.length;
      }

      scriptEnter(
        iid: number,
        instrumentedFileName: string,
        originalFileName: string
      ): void {}

      scriptExit(
        iid: number,
        wrappedExceptionVal: { exception: any } | undefined
      ): void {
        if (wrappedExceptionVal) {
          this.currentFrame.resetCalleeContext();
          this.currentFrame.stack.length = 0;
          this.excTaint = BOTTOM;
        }
      }

      binaryPre(
        iid: number,
        op: string,
        left: any,
        right: any,
        isOpAssign: boolean,
        isSwitchCaseComparison: boolean,
        isComputed: boolean
      ): void {
        if (isComputed) {
          this.remove();
          this.remove();
        } else {
          let rightTaint = this.take();
          let leftTaint;
          if (isSwitchCaseComparison) {
            leftTaint = BOTTOM;
          } else {
            leftTaint = this.take();
          }
          this.currentFrame.setCalleeContext(
            new UnaryOrBinaryContext(leftTaint, rightTaint)
          );
        }
      }

      binary(
        iid: number,
        op: string,
        left: any,
        right: any,
        result: any,
        isOpAssign: boolean,
        isSwitchCaseComparison: boolean,
        isComputed: boolean
      ): void {
        if (isComputed) {
          memory.delete(left, right);
          this.push(BOTTOM);
        } else {
          this.push(this.currentFrame.calleeCtx.apply(result));
          this.currentFrame.resetCalleeContext();
        }
      }

      unaryPre(iid: number, op: string, left: any): void {
        if (op === "void") {
          return;
        } else {
          let leftTaint = this.take();
          this.currentFrame.setCalleeContext(
            new UnaryOrBinaryContext(leftTaint)
          );
        }
      }

      unary(iid: number, op: string, left: any, result: any): void {
        if (op === "void") {
          this.remove();
          this.push(BOTTOM);
        } else {
          this.push(this.currentFrame.calleeCtx.apply(result));
          this.currentFrame.resetCalleeContext();
        }
      }

      conditional(iid: number, result: any): void {
        this.auxTaint = this.peek();
      }

      last(): void {
        this.push(this.auxTaint);
        this.auxTaint = BOTTOM;
      }

      endExpression(iid: number): void {
        this.remove();
      }

      endExecution(): void {}

      onReady(cb: () => void): void {
        cb();
      }
    }

    interface Context {
      enterCallee(thisValue: any, argsValue: any[]): void;
      getCalleeThis(thisValue: any): Taint;
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint;
      leaveCallee(resultValue: any, resultTaint: Taint): void;
      apply(resultValue: any, externalTaint?: Taint): Taint;
    }

    class UserFunctionContext implements Context {
      baseTaint: Taint;
      argsTaint: Taint[];
      resultTaint: Taint;

      constructor(baseTaint: Taint, argsTaint: Taint[]) {
        this.baseTaint = baseTaint;
        this.argsTaint = argsTaint;
        this.resultTaint = BOTTOM;
      }
      enterCallee(thisValue: any, argsValue: any) {}
      getCalleeThis(thisValue: any): Taint {
        return this.baseTaint;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any) {
        return this.argsTaint[argumentIndex];
      }
      leaveCallee(resultValue: any, resultTaint: Taint) {
        this.resultTaint = resultTaint;
      }
      apply(resultValue: any): Taint {
        return this.resultTaint;
      }
    }

    class NativeFunctionContext implements Context {
      taint: Taint;

      constructor(inputTaint: Taint) {
        this.taint = inputTaint;
      }
      enterCallee(thisValue: any, argsValue: any[]): void {}
      getCalleeThis(thisValue: any): Taint {
        return !isObject(thisValue) ? this.taint : BOTTOM;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint {
        return !isObject(argumentValue) ? this.taint : BOTTOM;
      }
      leaveCallee(resultValue: any, resultTaint: Taint): void {
        this.taint = join(this.taint, resultTaint);
      }
      apply(resultValue: any, externalTaint?: Taint): Taint {
        const taint = join(this.taint, externalTaint || BOTTOM);
        if (!isObject(resultValue)) {
          return taint;
        } else {
          memory.updateIntrinsic(resultValue, taint);
          return BOTTOM;
        }
      }
    }

    class GetFieldContext implements Context {
      baseTaint: Taint;
      resultTaint: Taint;

      constructor(baseTaint: Taint, storedTaint: Taint) {
        this.baseTaint = baseTaint;
        this.resultTaint = join(baseTaint, storedTaint);
      }
      enterCallee(thisValue: any, argsValue: any[]): void {}
      getCalleeThis(thisValue: any): Taint {
        return this.baseTaint;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint {
        return BOTTOM;
      }
      leaveCallee(resultValue: any, resultTaint: Taint): void {
        this.resultTaint = join(this.resultTaint, resultTaint);
      }
      apply(resultValue: any, externalTaint: Taint): Taint {
        const taint = join(this.resultTaint, externalTaint || BOTTOM);
        if (!isObject(resultValue)) {
          return taint;
        } else {
          return BOTTOM;
        }
      }
    }

    class PutFieldContext implements Context {
      baseTaint: Taint;
      valueTaint: Taint;

      constructor(baseTaint: Taint, valueTaint: Taint) {
        this.baseTaint = baseTaint;
        this.valueTaint = valueTaint;
      }
      enterCallee(thisValue: any, argsValue: any[]): void {}
      getCalleeThis(thisValue: any): Taint {
        return this.baseTaint;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint {
        return this.valueTaint;
      }
      leaveCallee(resultValue: any, resultTaint: Taint): void {}
      apply(resultValue: any): Taint {
        return this.valueTaint;
      }
    }

    class UnaryOrBinaryContext implements Context {
      resultTaint: Taint;

      constructor(leftTaint: Taint, rightTaint?: Taint) {
        this.resultTaint = join(leftTaint, rightTaint || BOTTOM);
      }
      enterCallee(thisValue: any, argsValue: any[]): void {}
      getCalleeThis(thisValue: any): Taint {
        return BOTTOM;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint {
        return BOTTOM;
      }
      leaveCallee(resultValue: any, resultTaint: Taint): void {}
      apply(resultValue: any): Taint {
        return this.resultTaint;
      }
    }

    class BottomContext implements Context {
      enterCallee(thisValue: any, argsValue: any[]): void {}
      getCalleeThis(thisValue: any): Taint {
        return BOTTOM;
      }
      getCalleeArgument(argumentIndex: number, argumentValue: any): Taint {
        return BOTTOM;
      }
      leaveCallee(resultValue: any, resultTaint: Taint): void {}
      apply(resultValue: any): Taint {
        return BOTTOM;
      }
    }

    const BOTTOM_CONTEXT: Context = new BottomContext();

    function __ytjs_source_test<T>(value: T): T {
      return value;
    }
    global.__ytjs_source_test = __ytjs_source_test;

    function __ytjs_sink_test<T>(value: T): T {
      return value;
    }
    global.__ytjs_sink_test = __ytjs_sink_test;

    function invokeFunAsSource(
      iid: number,
      f: Function,
      base: any,
      args: any[],
      result: any
    ): Taint {
      if (f === __ytjs_source_test) {
        return Taint(
          Label("__ytjs_source_test", Location(iid), {
            value: JSON.stringify(args[0]),
          })
        );
      } else if (f === Storage_prototype_getItem) {
        const instance =
          base === localStorage ? "localStorage" : "sessionStorage";
        const label = Label(`${instance}.getItem`, Location(iid), {
          key: "" + args[0],
          value: "" + result,
          ownership: getStorageItemOwnership(base, "" + args[0]),
        });
        collectStorageLabel(label);
        return Taint(label);
      } else if (f === fetch) {
        return Taint(
          Label("fetch_1", Location(iid), {
            method: (args[1] && args[1]["method"]) || "GET",
            url: args[0],
          })
        );
      }
      return BOTTOM;
    }

    function invokeFunAsSink(
      iid: number,
      f: Function,
      base: any,
      baseTaint: Taint,
      args: any[],
      argsTaint: Taint[]
    ): void {
      if (f === __ytjs_sink_test) {
        const taint = join(argsTaint[0], memory.getIntrinsic(args[0]));
        const sinkLabel = Label("__ytjs_sink_test", Location(iid), {
          value: JSON.stringify(args[0]),
        });
        console.log(taint, sinkLabel);
        collectFlow(taint, sinkLabel);
      } else if (f === Storage_prototype_setItem) {
        const instance =
          base === localStorage ? "localStorage" : "sessionStorage";
        const label = Label(`${instance}.setItem`, Location(iid), {
          key: "" + args[0],
          value: "" + args[1],
        });
        setStorageItemOwnership(base, "" + args[0], getScriptUrl());
        collectStorageLabel(label);
        collectFlow(join(argsTaint[1], memory.getIntrinsic(args[1])), label);
      } else if (f === navigator_sendBeacon) {
        collectFlow(
          join(
            args[0] ? join(argsTaint[0], memory.getIntrinsic(args[0])) : BOTTOM,
            args[1] ? join(argsTaint[1], memory.getIntrinsic(args[1])) : BOTTOM
          ),
          Label("navigator.sendBeacon", Location(iid), {
            url: "" + args[0],
          })
        );
      } else if (
        (f === XMLHttpRequest_prototype_open ||
          f === XMLHttpRequest_prototype_send) &&
        Reflect_getPrototypeOf(base) === XMLHttpRequest_prototype
      ) {
        if (f === XMLHttpRequest_prototype_send) {
          collectFlow(
            join(
              join(baseTaint, memory.getIntrinsic(base)),
              args[0]
                ? join(argsTaint[0], memory.getIntrinsic(args[0]))
                : BOTTOM
            ),
            Label("XMLHttpRequest_2", Location(iid), {
              ...XMLHttpRequest_META.get(base),
            })
          );
        }
      } else if (f === fetch) {
        collectFlow(
          join(
            argsTaint[0],
            args[1]
              ? join(
                  memory.getIntrinsic(args[1]),
                  args[1]["body"]
                    ? memory.getIntrinsic(args[1]["body"])
                    : BOTTOM
                )
              : BOTTOM
          ),
          Label("fetch_2", Location(iid), {
            method: (args[1] && args[1]["method"]) || "GET",
            url: args[0],
          })
        );
      } else if (base instanceof HTMLElement) {
        let taint: Taint = BOTTOM;
        for (let i = 0; i < args.length; ++i) {
          taint = join(taint, join(argsTaint[i], memory.getIntrinsic(i)));
        }
        collectFlow(
          taint,
          Label("HTMLElement[f]()", Location(iid), {
            tagName: base.tagName,
            f: f.name,
            args: [...args].map((arg) => "" + arg),
          })
        );
      }
    }

    function getFieldAsSource(
      iid: number,
      base: any,
      offset: any,
      val: any
    ): Taint {
      if (base === localStorage || base === sessionStorage) {
        if (Reflect_getOwnPropertyDescriptor(base, offset)) {
          const instance =
            base === localStorage ? "localStorage" : "sessionStorage";
          const label = Label(`${instance}.getItem`, Location(iid), {
            key: "" + offset,
            value: val,
            ownership: getStorageItemOwnership(base, "" + offset),
          });
          collectStorageLabel(label);
          return Taint(label);
        }
      } else if (base === document) {
        if (offset === "cookie") {
          return Taint(
            Label("document.cookie_1", Location(iid), {
              value: val,
            })
          );
        } else if (offset === "URL") {
          return Taint(
            Label(`document.URL`, Location(iid), {
              value: val,
            })
          );
        }
      } else if (base === location) {
        if (typeof val === "string") {
          return Taint(
            Label("location", Location(iid), {
              key: "" + offset,
              value: val,
            })
          );
        }
      } else if (base === navigator) {
        if (
          offset === "language" ||
          offset === "platform" ||
          offset === "userAgent"
        ) {
          return Taint(
            Label(`navigator.${offset}`, Location(iid), {
              value: val,
            })
          );
        }
      } else if (
        (offset === "response" ||
          offset === "responseText" ||
          offset === "responseURL" ||
          offset === "responseXML") &&
        Reflect_getPrototypeOf(base) === XMLHttpRequest_prototype
      ) {
        return Taint(
          Label("XMLHttpRequest_1", Location(iid), {
            ...XMLHttpRequest_META.get(base),
          })
        );
      }
      return BOTTOM;
    }

    function putFieldAsSink(
      iid: number,
      base: any,
      offset: any,
      val: any,
      valTaint: Taint
    ): void {
      if (base === localStorage || base === sessionStorage) {
        const instance =
          base === localStorage ? "localStorage" : "sessionStorage";
        const label = Label(`${instance}.setItem`, Location(iid), {
          key: "" + offset,
          value: "" + val,
        });
        setStorageItemOwnership(base, "" + offset, getScriptUrl());
        collectStorageLabel(label);
        collectFlow(join(valTaint, memory.getIntrinsic(val)), label);
      } else if (base === document) {
        if (offset === "cookie") {
          collectFlow(
            join(valTaint, memory.getIntrinsic(val)),
            Label("document.cookie_2", Location(iid), {
              value: "" + val,
            })
          );
        }
      } else if (base instanceof HTMLElement) {
        collectFlow(
          join(valTaint, memory.getIntrinsic(val)),
          Label(`HTMLElement[key]`, Location(iid), {
            tagName: base.tagName,
            key: "" + offset,
            value: "" + val,
          })
        );
      }
    }

    function _setupTrackablePromise(monitor: YuantijsAnalysis) {
      const completionTaintMap = new Map<symbol, Taint>();

      class TrackablePromise<T> extends Promise<T> {
        #id: symbol;

        constructor(
          executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
          ) => void
        ) {
          const id = Symbol();
          super(function (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
          ): void {
            executor(
              function (value) {
                const completionTaint =
                  monitor.currentFrame.calleeCtx.getCalleeArgument(0, value);
                completionTaintMap.set(id, completionTaint);
                resolve(value);
              },
              function (reason) {
                const completionTaint =
                  monitor.currentFrame.calleeCtx.getCalleeArgument(0, reason);
                completionTaintMap.set(id, completionTaint);
                reject(reason);
              }
            );
          });
          this.#id = id;
        }

        then<TResult1 = T, TResult2 = never>(
          onfulfilled?:
            | ((value: T) => TResult1 | PromiseLike<TResult1>)
            | undefined
            | null,
          onrejected?:
            | ((reason: any) => TResult2 | PromiseLike<TResult2>)
            | undefined
            | null
        ): Promise<TResult1 | TResult2> {
          const id = this.#id;
          return super.then(
            onfulfilled &&
              function (value) {
                monitor.currentFrame.setCalleeContext(
                  new UserFunctionContext(BOTTOM, [completionTaintMap.get(id)!])
                );
                const result = onfulfilled(value);
                monitor.currentFrame.resetCalleeContext();
                return result;
              },
            onrejected &&
              function (reason) {
                monitor.currentFrame.setCalleeContext(
                  new UserFunctionContext(BOTTOM, [completionTaintMap.get(id)!])
                );
                const result = onrejected(reason);
                monitor.currentFrame.resetCalleeContext();
                return result;
              }
          );
        }
      }

      global.Promise = TrackablePromise;

      // @ts-ignore
      Promise_prototype.then = function (onfulfilled, onrejected) {
        const thisPromise = this;
        return Promise_prototype_then.call(
          thisPromise,
          onfulfilled &&
            function (value) {
              monitor.currentFrame.setCalleeContext(
                new UserFunctionContext(BOTTOM, [
                  memory.getIntrinsic(thisPromise),
                ])
              );
              const result = onfulfilled(value);
              monitor.currentFrame.resetCalleeContext();
              return result;
            },
          onrejected &&
            function (reason) {
              monitor.currentFrame.setCalleeContext(
                new UserFunctionContext(BOTTOM, [
                  memory.getIntrinsic(thisPromise),
                ])
              );
              const result = onrejected(reason);
              monitor.currentFrame.resetCalleeContext();
              return result;
            }
        );
      };
    }

    const XMLHttpRequest_META = new WeakMap<
      XMLHttpRequest,
      { method?: string; url?: string }
    >();

    XMLHttpRequest_prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null | undefined,
      password?: string | null | undefined
    ): void {
      XMLHttpRequest_META.set(this, {
        method: method,
        url: url.toString(),
      });
      return XMLHttpRequest_prototype_open.call(
        this,
        method,
        url,
        async || true,
        username,
        password
      );
    };

    const localStorage_OWNERSHIP = new Map<string, string>();

    const sessionStorage_OWNERSHIP = new Map<string, string>();

    function getStorageItemOwnership(storage: Storage, key: string): string {
      return (
        (storage === localStorage
          ? localStorage_OWNERSHIP
          : sessionStorage_OWNERSHIP
        ).get(key) || ""
      );
    }

    function setStorageItemOwnership(
      storage: Storage,
      key: string,
      ownership: string
    ): void {
      (storage === localStorage
        ? localStorage_OWNERSHIP
        : sessionStorage_OWNERSHIP
      ).set(key, ownership);
    }

    window.addEventListener("error", (event) => {
      const error = event.error;
      if (error instanceof Error) {
        console.error(error.stack);
      }
    });

    J$.analysis = new YuantijsAnalysis();
  })(window.J$);
}
