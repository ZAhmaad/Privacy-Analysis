declare namespace Jalangi.Yuantijs {
  interface Location {
    sid: number;
    iid: number;
    url: string;
    loc: LocArray;
    sub: Location | null;
  }

  interface Label {
    id: number;
    type: string;
    location: Location;
    info: any;
  }

  interface Taint {
    type: string;
  }

  interface Bottom extends Taint {
    type: "bottom";
  }

  interface BaseTaint extends Taint {
    type: "base";
    label: Label;
  }

  interface JoinTaint extends Taint {
    type: "join";
    l: Taint;
    r: Taint;
  }

  interface Flow {
    taint: Taint;
    sinkLabel: Label;
  }

  interface TrackingResult {
    flowCollection: Flow[];
    storageLabelCollection: Label[];
  }

  type LabelMap = { [key: number]: Label };

  type LabelMapKey = keyof LabelMap;

  interface CompactFlow {
    taint: LabelMapKey[];
    sinkLabel: LabelMapKey;
  }

  interface CompactTrackingResult {
    labelMap: LabelMap;
    flowCollection: CompactFlow[];
    storageLabelCollection: LabelMapKey[];
  }
}

declare namespace Jalangi {
  type LocArray = [number, number, number, number];

  interface JalangiContext {
    smap: {
      [sid: number]: {
        [iid: number]: LocArray;
        url: string;
        evalSid?: number;
        evalIid?: number;
      };
    };
    analysis: JalangiAnalysis;
    sid: number;
    _: () => any;
  }

  interface JalangiAnalysis {}
}

interface Window {
  J$: Jalangi.JalangiContext;
  __ytjs_getTrackingResult?: () => Jalangi.Yuantijs.CompactTrackingResult;
  __ytjs_source_test?: <T>(value: T) => T;
  __ytjs_sink_test?: <T>(value: T) => T;
}
