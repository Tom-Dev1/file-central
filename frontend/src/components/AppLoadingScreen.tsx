// components/AppLoadingScreen.tsx

import { FolderClosed } from "lucide-react";
import classes from "./AppLoadingScreen.module.css";


export function AppLoadingScreen() {
  return (
    <div className={classes.centeredRow}>
      <div className={classes.centeredColumn}>
        <div className={classes.centeredRow2}>
          <FolderClosed className={classes.icon} />
        </div>

        <h1 className={classes.title}>File Central</h1>

        <p className={classes.description}>Loading your workspace...</p>

        <div className={classes.div}>
          <div className={classes.div2} />
        </div>
      </div>
    </div>
  );
}
