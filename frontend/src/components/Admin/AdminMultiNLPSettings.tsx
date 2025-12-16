/**
 * AdminMultiNLPSettings - DEPRECATED
 *
 * NLP REMOVAL (December 2025):
 * Multi-NLP system removed for server optimization.
 * Description extraction now via LLM API (LangExtract/Gemini).
 *
 * RAM reduction: 10-12 GB → 2-3 GB
 * Docker image: 2.5 GB → 800 MB
 */

import React from 'react';
import { AlertTriangle, Cpu, ExternalLink } from 'lucide-react';
import type { MultiNLPSettings } from '@/api/admin';

// Re-export for backwards compatibility
export type { MultiNLPSettings };

interface AdminMultiNLPSettingsProps {
  settings: MultiNLPSettings | null;
  setSettings: (settings: MultiNLPSettings | null) => void;
  isLoading: boolean;
  onSave: (settings: MultiNLPSettings) => void;
  isSaving: boolean;
  t: (key: string) => string;
}

export const AdminMultiNLPSettings: React.FC<AdminMultiNLPSettingsProps> = ({
  t
}) => {
  return (
    <div className="space-y-6">
      {/* Deprecation Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
              {t('admin.nlpRemovedTitle') || 'NLP System Removed'}
            </h3>
            <p className="text-amber-700 dark:text-amber-300 mb-4">
              {t('admin.nlpRemovedDescription') ||
                'The Multi-NLP system (SpaCy, Natasha, Stanza, GLiNER) has been removed in December 2025 for server optimization. Description extraction is now handled on-demand via LLM API (LangExtract/Google Gemini).'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                <div className="font-medium text-green-800 dark:text-green-200 mb-1">
                  RAM Reduction
                </div>
                <div className="text-green-700 dark:text-green-300">
                  10-12 GB → 2-3 GB (-75%)
                </div>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3">
                <div className="font-medium text-green-800 dark:text-green-200 mb-1">
                  Docker Image
                </div>
                <div className="text-green-700 dark:text-green-300">
                  2.5 GB → 800 MB (-68%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Extraction Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          {t('admin.llmExtractionTitle') || 'LLM-Based Extraction'}
        </h3>
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>
            {t('admin.llmExtractionInfo') ||
              'Descriptions are now extracted on-demand using Google Gemini API when a user navigates to a chapter. This approach:'}
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Reduces server RAM requirements significantly</li>
            <li>Provides higher quality extraction using state-of-the-art LLMs</li>
            <li>Supports Russian → English translation for image generation</li>
            <li>Costs approximately $0.02 per book</li>
          </ul>
          <div className="mt-4">
            <a
              href="https://ai.google.dev/gemini-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Learn more about Google Gemini API
            </a>
          </div>
        </div>
      </div>

      {/* Configuration Note */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Configuration:</strong> Set <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">GOOGLE_API_KEY</code> environment variable to enable LLM extraction.
        </p>
      </div>
    </div>
  );
};
