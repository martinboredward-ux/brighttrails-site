import { useEffect, useState } from "react";
import { fetchImageBlob } from "./api";

/** Fetches a stored picture with the password header and gives back a blob: URL for <img>. */
export function useBlobUrl(id: string | undefined): { url: string; error: string } {
  const [state, setState] = useState({ url: "", error: "" });
  useEffect(() => {
    if (!id) { setState({ url: "", error: "" }); return; }
    let live = true;
    let made = "";
    fetchImageBlob(id)
      .then((b) => { made = URL.createObjectURL(b); if (live) setState({ url: made, error: "" }); else URL.revokeObjectURL(made); })
      .catch((e) => { if (live) setState({ url: "", error: e instanceof Error ? e.message : "Could not load" }); });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return state;
}
