import { MessageSquareText, Plus, Settings, Square, WandSparkles } from 'lucide-react';

export function BoardSidebar({
  aiConversationPrompt,
  aiDivergence,
  aiGenerationActive,
  aiGenerationCount,
  aiProcessText,
  aiPromptDraft,
  aiQuestionFocus,
  aiQuestionLoading,
  aiQuestionStatusMessage,
  aiQuestions,
  aiSpecificity,
  aiStatusMessage,
  aiStreamText,
  aiStreamVisible,
  composer,
  locale,
  selectedPromptCard,
  setAiPromptDraft,
  setAiQuestionFocus,
  setAiStreamVisible,
  setComposer,
  setSidebarTab,
  sidebarTab,
  text,
  onAddNote,
  onAiDivergenceChange,
  onAiSpecificityChange,
  onGeneratePack,
  onGenerateQuestions,
  onOpenAiSettings,
  onPinPrompt,
  onPinQuestion,
  onStopGeneration,
  onStopQuestionGeneration,
}) {
  const sidebarTabs = [
    { id: 'capture', label: text.quickPanel.tab },
    { id: 'ai', label: text.aiPanel.tab },
    { id: 'questions', label: text.aiQuestionsPanel.tab },
  ];

  return (
    <aside className="workspace__sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label={text.sidebarTabsLabel}>
        {sidebarTabs.map((tab) => (
          <button
            key={tab.id}
            className={`sidebar-tabs__button${sidebarTab === tab.id ? ' sidebar-tabs__button--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={sidebarTab === tab.id}
            aria-controls={`sidebar-panel-${tab.id}`}
            id={`sidebar-tab-${tab.id}`}
            onClick={() => setSidebarTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        id="sidebar-panel-capture"
        className={`sidebar-tab-panel panel panel--capture${sidebarTab === 'capture' ? ' sidebar-tab-panel--active' : ''}`}
        role="tabpanel"
        aria-labelledby="sidebar-tab-capture"
        hidden={sidebarTab !== 'capture'}
      >
        <div className="panel__eyebrow">
          <span className="eyebrow">{text.quickPanel.eyebrow}</span>
          <h3 className="panel__title">{text.quickPanel.title}</h3>
        </div>
        <form className="stack" onSubmit={onAddNote}>
          <label className="field">
            <span className="field__label">{text.quickPanel.ideaLabel}</span>
            <textarea
              className="field__control field__control--textarea"
              placeholder={text.quickPanel.ideaPlaceholder}
              value={composer.text}
              onChange={(event) => setComposer((current) => ({ ...current, text: event.target.value }))}
            />
          </label>
          <div className="chip-row">
            {locale.tagSuggestions.map((tag) => (
              <button
                key={tag}
                className={`chip ${composer.tag === tag ? 'chip--active' : ''}`}
                type="button"
                onClick={() => setComposer((current) => ({ ...current, tag }))}
              >
                {tag}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field__label">{text.quickPanel.tagLabel}</span>
            <input
              className="field__control"
              value={composer.tag}
              onChange={(event) => setComposer((current) => ({ ...current, tag: event.target.value }))}
              placeholder={text.quickPanel.tagPlaceholder}
            />
          </label>
          <button className="button button--accent button--full" type="submit">
            <Plus size={15} /> {text.quickPanel.submit}
          </button>
        </form>
      </section>

      <section
        id="sidebar-panel-ai"
        className={`sidebar-tab-panel panel panel--ai${sidebarTab === 'ai' ? ' sidebar-tab-panel--active' : ''}`}
        role="tabpanel"
        aria-labelledby="sidebar-tab-ai"
        hidden={sidebarTab !== 'ai'}
      >
        <div className="panel__eyebrow">
          <h3 className="panel__title">{text.aiPanel.title}</h3>
        </div>
        <div className="ai-panel">
          <div className="prompt-card-grid" role="listbox" aria-label={text.aiPanel.promptLabel}>
            {locale.promptCards.map((promptCard) => (
              <button
                key={promptCard.id}
                className={`prompt-card-choice${selectedPromptCard?.id === promptCard.id ? ' prompt-card-choice--active' : ''}`}
                type="button"
                role="option"
                aria-selected={selectedPromptCard?.id === promptCard.id}
                onClick={() => setAiPromptDraft((current) => ({
                  ...current,
                  lensId: promptCard.id,
                  tag: promptCard.tag,
                }))}
              >
                <span className="prompt-card-choice__title">{promptCard.title}</span>
                <span className="prompt-card-choice__description">{promptCard.description}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field__label">{text.aiPanel.promptLabel}</span>
            <textarea
              className="field__control field__control--textarea ai-panel__input"
              placeholder={text.aiPanel.promptPlaceholder}
              value={aiPromptDraft.text}
              onChange={(event) => setAiPromptDraft((current) => ({ ...current, text: event.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">{text.aiPanel.tagLabel}</span>
            <input
              className="field__control"
              value={aiPromptDraft.tag}
              onChange={(event) => setAiPromptDraft((current) => ({ ...current, tag: event.target.value }))}
              placeholder={text.aiPanel.tagPlaceholder}
            />
          </label>
          <div className="prompt-card__status">
            <span className="prompt-card__status-label">{text.promptStatus.label}</span>
            <span>{aiStatusMessage}</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={onOpenAiSettings}>
            <Settings size={14} /> {text.aiSettings.button}
          </button>
          {aiStreamVisible ? (
            <div className="ai-stream-panel">
              <div className="ai-stream-panel__header">
                <span>{text.promptStatus.outputLabel}</span>
                <strong>{aiGenerationActive ? text.promptStatus.outputStreaming : text.promptStatus.outputReady}</strong>
              </div>
              <div className="ai-stream-panel__section">
                <span className="ai-stream-panel__label">{text.promptStatus.finalPromptLabel}</span>
                <pre className="ai-stream-panel__body ai-stream-panel__body--prompt">
                  {aiConversationPrompt || text.promptStatus.promptWaiting}
                </pre>
              </div>
              <div className="ai-stream-panel__section">
                <span className="ai-stream-panel__label">{text.promptStatus.processLabel}</span>
                <pre className="ai-stream-panel__body ai-stream-panel__body--process">
                  {aiProcessText || text.promptStatus.processWaiting}
                </pre>
              </div>
              <div className="ai-stream-panel__section">
                <span className="ai-stream-panel__label">{text.promptStatus.responseLabel}</span>
                <pre className="ai-stream-panel__body">
                  {aiStreamText || text.promptStatus.outputWaiting}
                </pre>
              </div>
            </div>
          ) : null}
          <label className="field field--range ai-panel__range">
            <span className="field__label">{text.promptControls.divergenceLabel}</span>
            <div className="range-control">
              <input
                className="range-control__input"
                type="range"
                min="0"
                max="100"
                step="1"
                value={aiDivergence}
                onChange={(event) => onAiDivergenceChange(Number(event.target.value))}
              />
              <span className="range-control__value">{aiDivergence}%</span>
            </div>
            <div className="range-control__legend">
              <span>{text.promptControls.focused}</span>
              <span>{text.promptControls.wild}</span>
            </div>
          </label>
          <label className="field field--range ai-panel__range">
            <span className="field__label">{text.promptControls.specificityLabel}</span>
            <div className="range-control">
              <input
                className="range-control__input"
                type="range"
                min="0"
                max="100"
                step="1"
                value={aiSpecificity}
                onChange={(event) => onAiSpecificityChange(Number(event.target.value))}
              />
              <span className="range-control__value">{aiSpecificity}%</span>
            </div>
            <div className="range-control__legend">
              <span>{text.promptControls.broad}</span>
              <span>{text.promptControls.concrete}</span>
            </div>
          </label>
          <div className="stack">
            <button className="button button--secondary button--full" type="button" onClick={onPinPrompt}>
              <Plus size={14} /> {text.promptActions.pin}
            </button>
            <button className="button button--ghost button--full" type="button" onClick={() => setAiStreamVisible((visible) => !visible)}>
              <MessageSquareText size={14} />
              {aiStreamVisible ? text.promptActions.hideOutput : text.promptActions.showOutput}
            </button>
            <button
              className="button button--accent button--full"
              type="button"
              onClick={onGeneratePack}
              disabled={aiGenerationActive}
            >
              <WandSparkles size={14} />
              {aiGenerationActive ? text.promptActions.generating : text.promptActions.generate(aiGenerationCount)}
            </button>
            {aiGenerationActive ? (
              <button className="button button--danger button--full" type="button" onClick={onStopGeneration}>
                <Square size={13} /> {text.promptActions.stop}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="sidebar-panel-questions"
        className={`sidebar-tab-panel panel panel--questions${sidebarTab === 'questions' ? ' sidebar-tab-panel--active' : ''}`}
        role="tabpanel"
        aria-labelledby="sidebar-tab-questions"
        hidden={sidebarTab !== 'questions'}
      >
        <div className="panel__eyebrow">
          <h3 className="panel__title">{text.aiQuestionsPanel.title}</h3>
        </div>
        <div className="ai-questions-panel">
          <label className="field">
            <span className="field__label">{text.aiQuestionsPanel.focusLabel}</span>
            <textarea
              className="field__control field__control--textarea ai-questions-panel__input"
              placeholder={text.aiQuestionsPanel.focusPlaceholder}
              value={aiQuestionFocus}
              onChange={(event) => setAiQuestionFocus(event.target.value)}
            />
          </label>
          <div className="prompt-card__status">
            <span className="prompt-card__status-label">{text.promptStatus.label}</span>
            <span>{aiStatusMessage}</span>
          </div>
          <div className="prompt-card__status">
            <span className="prompt-card__status-label">{text.aiQuestionsPanel.statusLabel}</span>
            <span>{aiQuestionStatusMessage}</span>
          </div>
          <button className="button button--ghost button--full" type="button" onClick={onOpenAiSettings}>
            <Settings size={14} /> {text.aiSettings.button}
          </button>

          <div className="question-list" aria-live="polite">
            {aiQuestions.length ? (
              aiQuestions.map((question, index) => (
                <article className="question-card" key={`${question}-${index}`}>
                  <p>{question}</p>
                  <button className="question-card__pin" type="button" onClick={() => onPinQuestion(question)}>
                    <Plus size={13} /> {text.aiQuestionsPanel.pinQuestion}
                  </button>
                </article>
              ))
            ) : (
              <p className="question-list__empty">
                {aiQuestionLoading ? text.aiQuestionsPanel.loading : text.aiQuestionsPanel.empty}
              </p>
            )}
          </div>

          <div className="stack">
            <button
              className="button button--accent button--full"
              type="button"
              onClick={onGenerateQuestions}
              disabled={aiQuestionLoading}
            >
              <WandSparkles size={14} />
              {aiQuestionLoading ? text.aiQuestionsPanel.generating : text.aiQuestionsPanel.generate(aiGenerationCount)}
            </button>
            {aiQuestionLoading ? (
              <button className="button button--danger button--full" type="button" onClick={onStopQuestionGeneration}>
                <Square size={13} /> {text.promptActions.stop}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}
