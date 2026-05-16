import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { getLocale } from '../lib/locale.js';
import { formatNoteTime } from '../lib/formatters.js';
import { projectTone } from '../lib/ui.js';

function ProjectCard({ project, language, onEnter, onDelete }) {
  const t = getLocale(language).text.home;
  const tone = projectTone(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article
      className="project-card"
      style={{ '--project-gradient': tone.gradient, '--project-tape': tone.tape }}
    >
      <div className="project-card__tape" aria-hidden="true" />
      <button className="project-card__body" type="button" onClick={onEnter}>
        <h3 className="project-card__title">{project.title}</h3>
        <div className="project-card__chips">
          <span className="project-card__count">{t.notesCount(project.noteCount ?? 0)}</span>
          {project.topTag ? <span className="project-card__tag">{project.topTag}</span> : null}
        </div>
        <span className="project-card__time">{formatNoteTime(language, project.updatedAt)}</span>
      </button>
      <div className="project-card__footer">
        {confirmDelete ? (
          <>
            <button className="mini-button mini-button--danger" type="button" onClick={onDelete}>
              <Trash2 size={13} /> {t.confirmDelete}
            </button>
            <button className="mini-button" type="button" onClick={() => setConfirmDelete(false)}>
              <X size={13} />
            </button>
          </>
        ) : (
          <button className="mini-button mini-button--ghost" type="button" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

export function ProjectsHome({ language, projects, onEnter, onCreate, onDelete, onLanguageChange }) {
  const [newTitle, setNewTitle] = useState('');
  const [showForm, setShowForm] = useState(false);
  const locale = getLocale(language);
  const t = locale.text;
  const ht = t.home;

  function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewTitle('');
    setShowForm(false);
  }

  return (
    <div className="home-shell">
      <div className="home-shell__glow home-shell__glow--a" aria-hidden="true" />
      <div className="home-shell__glow home-shell__glow--b" aria-hidden="true" />

      <header className="home-header">
        <div className="home-header__brand">
          <span className="home-header__dot" aria-hidden="true" />
          <span className="home-header__name">Brainstorm Studio</span>
        </div>
        <div className="language-switch">
          <span className="language-switch__label">{t.languageLabel}</span>
          <div className="segmented">
            {Object.entries(t.languageOptions).map(([key, label]) => (
              <button
                key={key}
                className={language === key ? 'is-active' : ''}
                type="button"
                onClick={() => onLanguageChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="home-hero">
        <h1 className="home-hero__title">
          {language === 'zh' ? '灵感工坊' : 'Idea Lab'}
        </h1>
        <p className="home-hero__tagline">{ht.tagline}</p>

        {showForm ? (
          <form className="create-form" onSubmit={handleCreate}>
            <input
              className="field__control create-form__input"
              placeholder={ht.newProjectPlaceholder}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button className="button button--accent" type="submit">
              <Plus size={15} /> {ht.createProject}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => { setShowForm(false); setNewTitle(''); }}
            >
              {ht.cancel}
            </button>
          </form>
        ) : (
          <button className="button button--accent home-hero__cta" type="button" onClick={() => setShowForm(true)}>
            <Plus size={17} /> {ht.newProject}
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="home-empty">
          <p className="home-empty__title">{ht.emptyTitle}</p>
          <p className="home-empty__hint">{ht.emptyHint}</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              language={language}
              onEnter={() => onEnter(project.id)}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
