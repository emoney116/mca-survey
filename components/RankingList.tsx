"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { getGoalByKey, type GoalKey } from "@/lib/goals";

type RankingListProps = {
  order: GoalKey[];
  onChange: (order: GoalKey[]) => void;
};

type SortableGoalCardProps = {
  goalKey: GoalKey;
  rank: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  overlay?: boolean;
};

function SortableGoalCard({
  goalKey,
  rank,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  overlay = false,
}: SortableGoalCardProps) {
  const goal = getGoalByKey(goalKey);
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: goalKey,
      disabled: overlay,
    });

  if (!goal) {
    return null;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`ranking-card ${isDragging ? "is-dragging" : ""} ${overlay ? "is-overlay" : ""}`}
      style={style}
    >
      <div className="rank-badge" aria-label={`Rank ${rank}`}>
        {rank}
      </div>
      <div className="ranking-copy">
        <span>{goal.label}</span>
      </div>
      <div className="ranking-actions" aria-label={`Move ${goal.label}`}>
        <button
          type="button"
          className="icon-button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move ${goal.label} up`}
          title={`Move ${goal.label} up`}
        >
          <ChevronUp aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move ${goal.label} down`}
          title={`Move ${goal.label} down`}
        >
          <ChevronDown aria-hidden="true" size={18} />
        </button>
      </div>
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="drag-handle"
        aria-label={`Drag ${goal.label}`}
        title={`Drag ${goal.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" size={22} />
      </button>
    </div>
  );
}

export function RankingList({ order, onChange }: RankingListProps) {
  const [activeId, setActiveId] = useState<GoalKey | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function move(goalKey: GoalKey, direction: -1 | 1) {
    const currentIndex = order.indexOf(goalKey);
    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= order.length) {
      return;
    }

    onChange(arrayMove(order, currentIndex, nextIndex));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as GoalKey);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = order.indexOf(active.id as GoalKey);
    const newIndex = order.indexOf(over.id as GoalKey);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onChange(arrayMove(order, oldIndex, newIndex));
  }

  return (
    <DndContext
      id="metrolina-goal-ranking"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="ranking-list">
          {order.map((goalKey, index) => (
            <SortableGoalCard
              key={goalKey}
              goalKey={goalKey}
              rank={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < order.length - 1}
              onMoveUp={() => move(goalKey, -1)}
              onMoveDown={() => move(goalKey, 1)}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <SortableGoalCard
            goalKey={activeId}
            rank={order.indexOf(activeId) + 1}
            canMoveUp={false}
            canMoveDown={false}
            onMoveUp={() => undefined}
            onMoveDown={() => undefined}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
