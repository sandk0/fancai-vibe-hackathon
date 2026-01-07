import React from 'react';
import { BookReader } from '@/components/Reader/BookReader';

const ChapterPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background pt-safe pb-safe">
      <BookReader />
    </div>
  );
};

export default ChapterPage;