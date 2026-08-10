import {
  ArrowLeft,
  Cloud,
  File,
  FileArchive,
  FileImage,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Home,
  Search,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Tag, Typography } from "antd";
import { clsx as cn } from "clsx";
import classes from "./NotFound.module.css";


function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className={classes.content}>
      <div
        aria-hidden="true"
        className={classes.decoration}
      />

      <div
        aria-hidden="true"
        className={classes.decoration2}
      />

      <header className={classes.header}>
        <Link to="/" className={classes.link}>
          <span className={classes.centeredRow}>
            <Cloud className={classes.icon} />
          </span>

          <span className={classes.span}>File Central</span>
        </Link>
      </header>

      <section className={classes.section}>
        <div className={classes.div}>
          <Tag icon={<FileQuestion className={classes.icon2} />} className={classes.tag}>File location unavailable</Tag>

          <Typography.Text className={classes.text}>Error 404</Typography.Text>

          <h1 className={classes.title}>
            This file seems to be <span className={classes.span2}>missing</span>
          </h1>

          <p className={classes.description}>
            The page, file, or folder you requested may have been moved, renamed, deleted, or is no longer shared with
            your account.
          </p>

          <div className={classes.column}>
            <Button type="primary" size="large" icon={<Home className={classes.icon3} />} onClick={() => navigate("/")}>Return home</Button>

            <Button size="large" icon={<ArrowLeft className={classes.icon4} />} onClick={() => navigate(-1)}>Go back</Button>
          </div>

          <div className={classes.centeredRow2}>
            <div className={classes.row}>
              <Search className={classes.icon5} />
              Check the file name
            </div>

            <div className={classes.row}>
              <FolderSearch className={classes.icon6} />
              Check the folder location
            </div>
          </div>
        </div>

        <div className={classes.centeredRow3}>
          <FileNotFoundIllustration />
        </div>
      </section>
    </main>
  );
}

function FileNotFoundIllustration() {
  return (
    <div aria-hidden="true" className={classes.centeredRow4}>
      <div className={classes.decoration3} />

      <div className={classes.decoration4} />

      <FloatingFile className={classes.floatingFileOne} icon={FileText} label="DOC" />

      <FloatingFile className={classes.floatingFileTwo} icon={FileImage} label="IMG" />

      <FloatingFile className={classes.floatingFileThree} icon={FileSpreadsheet} label="XLS" />

      <FloatingFile className={classes.floatingFileFour} icon={FileArchive} label="ZIP" />

      <div className={classes.centeredRow5}>
        <div className={classes.decoration5} />

        <div className={classes.centeredColumn}>
          <div className={classes.centeredRow6}>
            <FolderSearch className={classes.icon7} />

            <span className={classes.questionBadge}>
              ?
            </span>
          </div>

          <p className={classes.paragraph}>File not found</p>

          <p className={classes.description2}>
            We searched every folder, but this file is no longer here.
          </p>
        </div>
      </div>

      <div className={classes.decoration6} />
      <div className={classes.icon8} />
      <div className={classes.decoration7} />
    </div>
  );
}

interface FloatingFileProps {
  className: string;
  icon: typeof File;
  label: string;
}

function FloatingFile({ className, icon: Icon, label }: FloatingFileProps) {
  return (
    <div
      className={cn(classes.centeredColumn2, className)}
    >
      <Icon className={classes.icon9} />

      <span className={classes.span3}>{label}</span>
    </div>
  );
}

export default NotFoundPage;
