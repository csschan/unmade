import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=new_id)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum("business", "contributor", "both", name="user_role"), default="both")
    paypal_email = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    projects = relationship("Project", back_populates="business")
    submissions = relationship("Submission", back_populates="contributor")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=new_id)
    business_id = Column(String, ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    budget_usd = Column(Numeric(10, 2), nullable=False)
    paypal_order_id = Column(String, nullable=True)
    status = Column(
        Enum("draft", "collecting", "fusing", "ready", "sold", "expired", name="project_status"),
        default="draft",
    )
    demand_analysis = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    business = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project")
    product = relationship("Product", back_populates="project", uselist=False)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=new_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    description = Column(Text, nullable=False)
    target_contributor = Column(String, nullable=True)
    location_hint = Column(String, nullable=True)
    validation_criteria = Column(Text, nullable=False)
    reward_usd = Column(Numeric(10, 2), default=2.00)
    max_submissions = Column(Integer, default=10)
    accepted_count = Column(Integer, default=0)
    status = Column(Enum("open", "filled", "closed", name="task_status"), default="open")

    project = relationship("Project", back_populates="tasks")
    submissions = relationship("Submission", back_populates="task")


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String, primary_key=True, default=new_id)
    task_id = Column(String, ForeignKey("tasks.id"), nullable=False)
    contributor_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    evidence_url = Column(String, nullable=True)
    ai_relevance_score = Column(Float, default=0.0)
    ai_uniqueness_score = Column(Float, default=0.0)
    status = Column(
        Enum("pending", "accepted", "rejected", "paid", name="submission_status"),
        default="pending",
    )
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    task = relationship("Task", back_populates="submissions")
    contributor = relationship("User", back_populates="submissions")


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=new_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    findings = Column(JSON, nullable=False)
    fusion_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    project = relationship("Project", back_populates="product")
    attributions = relationship("Attribution", back_populates="product")


class Attribution(Base):
    __tablename__ = "attributions"

    id = Column(String, primary_key=True, default=new_id)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    contributor_id = Column(String, ForeignKey("users.id"), nullable=False)
    submission_ids = Column(JSON, nullable=False)
    marginal_contribution = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    payout_usd = Column(Numeric(10, 2), nullable=False)
    paypal_payout_item_id = Column(String, nullable=True)
    status = Column(
        Enum("pending", "sent", "completed", "failed", name="attribution_status"),
        default="pending",
    )
