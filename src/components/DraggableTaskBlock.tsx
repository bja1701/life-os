import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ScheduledBlock } from '@/lib/scheduler';

interface DraggableTaskBlockProps {
    block: ScheduledBlock;
    top: number;
    height: number;
    onClick: (block: ScheduledBlock) => void;
    onComplete: (taskId: string) => void;
}

export function DraggableTaskBlock({ block, top, height, onClick, onComplete }: DraggableTaskBlockProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: block.id,
        data: {
            task: block,
            originalTop: top
        },
    });

    const style: React.CSSProperties = {
        position: 'absolute',
        top: `${top}px`,
        height: `${height}px`,
        left: '50%', // Right half of the column
        right: '2px', // Slight margin
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none', // Required for dnd-kit
    };

    // Determine styling based on state
    let colorClass = 'bg-indigo-100 border-l-4 border-indigo-500 text-indigo-900'; // Core Default

    if (block.isCompleted) {
        colorClass = 'bg-zinc-100 border-l-4 border-zinc-300 text-zinc-400 grayscale opacity-75';
    } else if (block.priority_tier === 'critical') {
        colorClass = 'bg-rose-100 border-l-4 border-rose-500 text-rose-900';
    } else if (block.priority_tier === 'backlog') {
        colorClass = 'bg-zinc-100 border-l-4 border-zinc-400 text-zinc-700';
    }

    // Virtual (Tentative) styling
    const borderStyle = block.isVirtual ? 'border-dashed' : 'border-solid';

    // Compact Mode for 15m tasks (< 30px height roughly)
    const isSmall = height < 35;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`absolute rounded-r shadow-sm text-xs transition-all hover:z-50 hover:shadow-md cursor-grab active:cursor-grabbing group overflow-hidden flex flex-col 
                ${isSmall ? 'justify-center px-2' : 'justify-between px-2 py-1.5'} 
                ${colorClass} ${borderStyle} border-white border-b-2`} // Added border-white and border-b-2 for separation
            onClick={(e) => {
                if (!isDragging) onClick(block);
            }}
        >
            <div className="flex justify-between items-start gap-1 w-full">
                <span className={`font-semibold overflow-hidden text-ellipsis leading-tight ${block.isCompleted ? 'line-through' : ''} ${isSmall ? 'whitespace-nowrap' : 'line-clamp-2'}`}>
                    {/* Visual Drag Handle for larger blocks */}
                    {!isSmall && <span className="inline-block mr-1 opacity-50 cursor-grab">⋮⋮</span>}
                    {block.taskTitle}
                </span>
            </div>

            {/* Elements hidden for small blocks */}
            {!isSmall && (
                <div className="flex justify-between items-end mt-1">
                    <span className="text-[10px] opacity-70 font-mono">
                        {block.durationMinutes}m
                    </span>

                    {/* Quick Complete Button - Prevent Drag Propagation */}
                    <button
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors
                ${block.isCompleted
                                ? 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'
                                : 'bg-white/50 hover:bg-white text-current'}`}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onComplete(block.taskId);
                        }}
                    >
                        {block.isCompleted ? 'Done' : 'Check'}
                    </button>
                </div>
            )}
        </div>
    );
}
